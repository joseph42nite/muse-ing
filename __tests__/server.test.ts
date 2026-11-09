/**
 * @jest-environment node
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals"
import { hashPassword, verifyPassword } from "../lib/server/password"
import * as fmt from "../lib/server/format"
import { get, run, transaction } from "../lib/server/db"
import * as songs from "../lib/server/songs"
import type { SessionUser } from "../lib/server/auth"

// db() reads these lazily on first query
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "muse-test-"))
process.env.DATABASE_PATH = path.join(dir, "test.db")
process.env.SEED_DEMO_DATA = "true"

const user = (id: string, role: SessionUser["role"]) => ({ id, role }) as SessionUser
const arjun = user("artist-arjun-01", "artist")
const maya = user("artist-maya-02", "artist")
const admin = user("x", "admin")

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }))

describe("password", () => {
  it("round-trips and rejects wrong or malformed hashes", () => {
    const h = hashPassword("correct horse")
    expect(verifyPassword("correct horse", h)).toBe(true)
    expect(verifyPassword("wrong", h)).toBe(false)
    expect(verifyPassword("x", "plain")).toBe(false)
    expect(verifyPassword("x", "scrypt$abcd$")).toBe(false)
  })
})

describe("format helpers", () => {
  it("normalizes instagram handles", () => {
    expect(fmt.normalizeInstagramHandle("arjun")).toBe("@arjun")
    expect(fmt.normalizeInstagramHandle("@arjun")).toBe("@arjun")
    expect(fmt.normalizeInstagramHandle("https://instagram.com/a")).toBe("https://instagram.com/a")
    expect(fmt.normalizeInstagramHandle("  ")).toBeNull()
  })
  it("normalizes promoter codes, phones and LIKE input", () => {
    expect(fmt.normalizePromoterCode(" ab-12 ")).toBe("AB12")
    expect(fmt.normalizePromoterCode("--")).toBeNull()
    expect(fmt.last10Digits("+91 98765-43210")).toBe("9876543210")
    expect(fmt.escapeLike("50%_off\\")).toBe("50\\%\\_off\\\\")
  })
})

describe("song ownership and upvotes", () => {
  beforeAll(() => {
    // seed runs on first db access
    expect(get("SELECT 1 FROM users WHERE email = 'artist@museing.com'")).toBeTruthy()
  })

  it("only lets an artist touch songs on their own gigs", () => {
    expect(songs.ownedSong(arjun, "playlist-arjun-1")).toBeTruthy()
    expect(songs.ownedSong(maya, "playlist-arjun-1")).toBeUndefined()
    expect(songs.ownedSong(admin, "playlist-arjun-1")).toBeTruthy()
    expect(songs.ownsEvent(arjun, "gig-koramangala-tonight")).toBe(true)
    expect(songs.ownsEvent(maya, "gig-koramangala-tonight")).toBe(false)
    expect(songs.ownsEvent(admin, "no-such-gig")).toBe(false)
  })

  it("toggles one vote per voter and keeps the count in step", () => {
    const count = () => get("SELECT upvotes FROM song_requests WHERE id = 'playlist-arjun-2'").upvotes
    const before = count()
    expect(songs.toggleUpvote("playlist-arjun-2", "voter-a")).toBe(true)
    expect(count()).toBe(before + 1)
    songs.addUpvote("playlist-arjun-2", "voter-a") // already voted: no-op
    expect(count()).toBe(before + 1)
    expect(songs.toggleUpvote("playlist-arjun-2", "voter-a")).toBe(false)
    expect(count()).toBe(before)
  })

  it("rolls back a failed transaction", () => {
    expect(() =>
      transaction(() => {
        run("UPDATE song_requests SET upvotes = 999 WHERE id = 'playlist-arjun-3'")
        throw new Error("boom")
      })
    ).toThrow("boom")
    expect(get("SELECT upvotes FROM song_requests WHERE id = 'playlist-arjun-3'").upvotes).not.toBe(999)
  })
})
