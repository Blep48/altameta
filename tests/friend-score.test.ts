import { beforeEach,it,expect,vi } from "vitest";
import { savePendingScore,retryPendingScore,getPendingScore,clearPendingScores } from "../src/lib/duel/pending-score";
import { getFriendChallenge,submitFriendScore } from "../src/lib/duel/friend-challenges";
vi.mock("../src/lib/duel/friend-challenges",()=>({getFriendChallenge:vi.fn(),submitFriendScore:vi.fn()}));
beforeEach(()=>{localStorage.clear();clearPendingScores();vi.mocked(getFriendChallenge).mockReset();vi.mocked(submitFriendScore).mockReset()});
it("retains a failed upload and retries the original score",async()=>{
 savePendingScore({code:"A",token:"token",role:"creator",seed:1,score:12});
 vi.mocked(getFriendChallenge).mockRejectedValueOnce(new Error("offline"));
 expect(await retryPendingScore("A")).toBe(false);expect(getPendingScore("A")?.score).toBe(12);
 savePendingScore({code:"A",token:"token",role:"creator",seed:1,score:99});
 vi.mocked(getFriendChallenge).mockResolvedValue(null);
 vi.mocked(submitFriendScore).mockResolvedValue({} as never);
 expect(await retryPendingScore("A")).toBe(true);
 expect(submitFriendScore).toHaveBeenCalledWith("A","token",12);expect(getPendingScore("A")).toBeNull();
});
it("acknowledges a score the server accepted before connection loss",async()=>{
 savePendingScore({code:"A",token:"token",role:"creator",seed:1,score:12});
 vi.mocked(getFriendChallenge).mockResolvedValue({creator_score:12} as never);
 expect(await retryPendingScore("A")).toBe(true);expect(submitFriendScore).not.toHaveBeenCalled();
});
