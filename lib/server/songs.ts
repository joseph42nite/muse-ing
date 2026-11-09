import { get, run, transaction } from "./db"
import type { SessionUser } from "./auth"

/** Adds or removes one voter's upvote on a song and keeps the cached count in step. */
export function toggleUpvote(requestId: string, voterToken: string): boolean {
  return transaction(() => {
    const removed = run("DELETE FROM song_upvotes WHERE request_id = ? AND voter_token = ?", requestId, voterToken)
    if (removed.changes) {
      run("UPDATE song_requests SET upvotes = MAX(0, upvotes - 1) WHERE id = ?", requestId)
      return false
    }
    run("INSERT INTO song_upvotes (request_id, voter_token) VALUES (?, ?)", requestId, voterToken)
    run("UPDATE song_requests SET upvotes = upvotes + 1 WHERE id = ?", requestId)
    return true
  })
}

/** Upvotes once; does nothing if this voter already upvoted the song. */
export function addUpvote(requestId: string, voterToken: string) {
  const res = run("INSERT OR IGNORE INTO song_upvotes (request_id, voter_token) VALUES (?, ?)", requestId, voterToken)
  if (res.changes) run("UPDATE song_requests SET upvotes = upvotes + 1 WHERE id = ?", requestId)
}

/** True when the user is an admin or the artist on this event. */
export function ownsEvent(user: SessionUser, eventId: string): boolean {
  if (user.role === "admin") return Boolean(get("SELECT 1 FROM events WHERE id = ?", eventId))
  return Boolean(get("SELECT 1 FROM events WHERE id = ? AND artist_id = ?", eventId, user.id))
}

/** The song if it belongs to one of this user's events (any event for admins), else undefined. */
export function ownedSong<T = any>(user: SessionUser, requestId: string): T | undefined {
  return get<T>(
    `SELECT sr.* FROM song_requests sr JOIN events e ON e.id = sr.event_id
      WHERE sr.id = ? AND (? = 'admin' OR e.artist_id = ?)`,
    requestId,
    user.role,
    user.id
  )
}
