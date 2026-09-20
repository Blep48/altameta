import {beforeEach,it,expect,vi} from "vitest";
const tracks:FakeAudio[]=[];
class FakeAudio{
 src:string;paused=true;currentTime=12;loop=false;preload="";volume=0;
 constructor(src:string){this.src=src;tracks.push(this)}
 play=vi.fn(async()=>{this.paused=false});pause=vi.fn(()=>{this.paused=true});load=vi.fn();removeAttribute=vi.fn();
}
beforeEach(()=>{vi.resetModules();tracks.length=0;vi.stubGlobal("Audio",FakeAudio)});
it("reuses the playing MP3 and resumes the same track after mute",async()=>{
 const a=await import("../src/lib/duel/audio");a.startMusic("menu");a.startMusic("menu");expect(tracks).toHaveLength(1);
 a.setMuted(true);expect(tracks[0]?.paused).toBe(true);a.setMuted(false);expect(tracks).toHaveLength(1);expect(tracks[0]?.currentTime).toBe(12);
 a.stopMusic();
});
it("restores note feedback without recreating background music",async()=>{
 const start=vi.fn();class Context{state="running";currentTime=0;destination={};createOscillator(){return {type:"",frequency:{value:0},connect:vi.fn(),start,stop:vi.fn(),disconnect:vi.fn(),onended:null}}createGain(){return {gain:{setValueAtTime:vi.fn(),linearRampToValueAtTime:vi.fn(),exponentialRampToValueAtTime:vi.fn()},connect:vi.fn(),disconnect:vi.fn()}}}
 vi.stubGlobal("AudioContext",Context);const a=await import("../src/lib/duel/audio");a.startMusic("rhythm");a.sfx.note(440);expect(start).toHaveBeenCalledTimes(1);expect(tracks).toHaveLength(1);a.setMuted(true);a.sfx.note(440);expect(start).toHaveBeenCalledTimes(1);a.stopMusic();
});
