import type { ActiveMatch } from "./types";import { submitFriendScore } from "./friend-challenges";
export async function submitIfFriend(match:ActiveMatch|null,score:number){if(!match?.friend)return false;await submitFriendScore(match.friend.code,match.friend.token,score);return true}
