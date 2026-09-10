import { cycle, pathPoint, smooth, mix } from './jobsite-campus-activity.mjs';
// The same cycle owns the carrier, suspended piece and installed count.
export function installation(progress, count) {
    const c=cycle(progress,count),placed=progress>=1||c.phase>=.88;
    return {...c,placed,installed:Math.min(count,c.completed+(progress<1&&placed?1:0)),label:c.phase<.14?'Collect from laydown':c.phase<.42?'Transport to the work front':c.phase<.56?'Rig and lift':c.phase<.76?'Swing into position':c.phase<.88?'Lower and connect':'Release load / return empty'};
}
export function deliveryPose(progress,count,base,target,bottom=0) {
    const c=installation(progress,count),lane=base[0]===-14?-2:base[0],staging=[lane,0,48],pickup=[base[0],0,base[2]+8];
    const route=[staging,[lane,0,38],[lane,0,pickup[2]],pickup];
    let vehicle=staging;
    if(c.phase>=.14&&c.phase<.42)vehicle=pathPoint(route,smooth((c.phase-.14)/.28));
    else if(c.phase>=.42&&c.phase<.88)vehicle=pickup;
    else if(c.phase>=.88)vehicle=pathPoint([...route].reverse(),smooth((c.phase-.88)/.12));
    const start=[pickup[0],1.4-bottom,pickup[2]],raised=[start[0],Math.max(start[1],target[1])+6,start[2]],over=[target[0],raised[1],target[2]];
    let cargo=[vehicle[0],1.4-bottom,vehicle[2]];
    if(c.phase>=.42&&c.phase<.56)cargo=start.map((v,i)=>mix(v,raised[i],smooth((c.phase-.42)/.14)));
    else if(c.phase>=.56&&c.phase<.76)cargo=raised.map((v,i)=>mix(v,over[i],smooth((c.phase-.56)/.2)));
    else if(c.phase>=.76)cargo=over.map((v,i)=>mix(v,target[i],smooth((c.phase-.76)/.12)));
    return {...c,vehicle,cargo,staging,pickup,carried:c.phase<.42,suspended:c.phase>=.42&&c.phase<.88};
}
