export type PlanDrag = {
 id:string; pointerId:number; start:{x:number;y:number}; pose:{x:number;y:number};
 screen:{x:number;y:number}; proposed:{x:number;y:number}|null;
};

/** Screen threshold is independent of zoom; the start pose never follows preview. */
export function planDragPosition(drag:PlanDrag,world:{x:number;y:number},screen:{x:number;y:number}) {
 if(Math.hypot(screen.x-drag.screen.x,screen.y-drag.screen.y)<4&&!drag.proposed)return null;
 return {x:drag.pose.x+world.x-drag.start.x,y:drag.pose.y+world.y-drag.start.y};
}

export function displayStudioCoordinate(raw:string):string {
 const n=Number(raw);
 return raw.trim()!==''&&Number.isFinite(n)?String(Math.round(n*10)/10):raw;
}
