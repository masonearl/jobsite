export const clamp = value => Math.max(0, Math.min(1, value));
export const mix = (a, b, t) => a + (b - a) * clamp(t);
export const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
export const lerpPoint = (a, b, t) => a.map((v, i) => mix(v, b[i], t));
export const GRADE_CYCLES = 6;
export const TRENCH_CELLS = 24;
export function cycle(progress, count) {
    const p = clamp(progress) * count;
    return { index: Math.min(count - 1, Math.floor(p)), phase: progress >= 1 ? 1 : p % 1, completed: Math.floor(p) };
}
export function pathPoint(points, progress) {
    if(progress<=0)return points[0].slice();if(progress>=1)return points.at(-1).slice();
    const lengths = points.slice(1).map((p, i) => Math.hypot(...p.map((v, j) => v - points[i][j])));
    let distance = clamp(progress) * lengths.reduce((a, b) => a + b, 0);
    for (let i = 0; i < lengths.length; i++) {
        if (distance <= lengths[i] || i === lengths.length - 1) return lerpPoint(points[i], points[i + 1], lengths[i] ? distance / lengths[i] : 0);
        distance -= lengths[i];
    }
    return points[0].slice();
}
export function earthCell(index, lane = 0) {
    return { cut: [-52 + lane * 27, -44 + index * 10], fill: [22 + lane * 27, -44 + index * 10] };
}
export function earthCycle(progress, lane = 0) {
    const { index, phase } = cycle(progress, GRADE_CYCLES), cell = earthCell(index, lane);
    const machine = [cell.cut[0] + 6, 0, cell.cut[1]];
    if(index>0&&phase<.08){const previous=earthCell(index-1,lane);machine[2]=mix(previous.cut[1],cell.cut[1],smooth(phase/.08));}
    const loading = [machine[0], 0, machine[2] + 7.5], dumping = [cell.fill[0], 0, cell.fill[1] + 5];
    const cut = smooth((phase - .08) / .17), fill = smooth((phase - .7) / .1);
    let truck = loading, tip = 0;
    const haul = [loading, [loading[0] + 5, 0, loading[2] + 5], [dumping[0] - 7, 0, dumping[2] + 5], dumping];
    if (phase >= .5 && phase < .69) truck = pathPoint(haul, (phase - .5) / .19);
    if (phase >= .69 && phase < .81) { truck = dumping; tip = Math.sin(clamp((phase - .69) / .12) * Math.PI) * .75; }
    if (phase >= .81) truck = pathPoint([...haul].reverse(), (phase - .81) / .19);
    const soil = phase >= .19 && phase < .46;
    const bucket = phase < .08 ? [machine[0]-5,2.8,machine[2]] : phase < .26 ? [cell.cut[0], mix(2.8, .05, smooth(phase / .2)), cell.cut[1]] : phase < .34 ? [cell.cut[0], mix(.05, 5.5, (phase - .26) / .08), cell.cut[1]] : phase < .43 ? lerpPoint([cell.cut[0], 5.5, cell.cut[1]], [loading[0], 4.2, loading[2] + .5], smooth((phase - .34) / .09)) : phase < .5 ? [loading[0], 4.2, loading[2] + .5] : lerpPoint([loading[0], 4.2, loading[2] + .5], [cell.cut[0], 2.8, cell.cut[1]], smooth((phase - .5) / .35));
    const label = phase < .26 ? 'Cutting the bank' : phase < .43 ? 'Swinging a loaded bucket' : phase < .5 ? 'Loading the haul truck' : phase < .69 ? 'Hauling to the fill' : phase < .81 ? 'Tipping and spreading fill' : 'Returning for the next load';
    return { ...cell, cutPoint:cell.cut, fillPoint:cell.fill, index, phase, machine, loading, dumping, truck, bucket, cut, fill, tip, soil, payload: phase >= .46 && phase < .77 ? 1 : 0, label };
}
export function earthProfile(progress) {
    const completed=cycle(progress,GRADE_CYCLES),current=earthCycle(progress);
    return Array.from({length:GRADE_CYCLES*2},(_,j)=>{
        const i=Math.floor(j/2),cell=earthCell(i,j%2);
        const cut=i<completed.index||progress>=1?1:i===completed.index?current.cut:0;
        const fill=i<completed.index||progress>=1?1:i===completed.index?current.fill:0;
        return {...cell,cutRemaining:1-cut,fillRemaining:1-fill};
    });
}
export function earthHeight(x,z,progress) {
    return earthProfile(progress).reduce((h,cell)=>h+Math.exp(-((x-cell.cut[0])**2/75+(z-cell.cut[1])**2/30))*1.8*cell.cutRemaining-Math.exp(-((x-cell.fill[0])**2/100+(z-cell.fill[1])**2/36))*1.05*cell.fillRemaining,-.08);
}
export function trenchStages(progress) {
    const head = clamp(progress) * (TRENCH_CELLS + 3);
    return { dig: Math.min(TRENCH_CELLS, head), pipe: Math.max(0, Math.min(TRENCH_CELLS, head - 1.5)), fill: Math.max(0, Math.min(TRENCH_CELLS, head - 3)) };
}
export function trenchX(front) { return -58 + Math.min(TRENCH_CELLS, Math.max(0, front)) * 4.8; }
export function trenchDepth(x, z, progress, center = 30) {
    const stage = trenchStages(progress), segment = (x + 58) / 4.8;
    if (Math.abs(z - center) > 1.6 || segment < 0 || segment > TRENCH_CELLS) return 0;
    return -1.65 * clamp(stage.dig - segment) * clamp(segment - stage.fill) || 0;
}
export function armAngles(reach, rise, boom = 5, stick = 4) {
    const distance = Math.max(.2, Math.min(boom + stick - .02, Math.hypot(reach, rise)));
    const elbow = -Math.acos(Math.max(-1, Math.min(1, (distance ** 2 - boom ** 2 - stick ** 2) / (2 * boom * stick))));
    const shoulder = Math.atan2(rise, reach) - Math.atan2(stick * Math.sin(elbow), boom + stick * Math.cos(elbow));
    return { shoulder, elbow };
}
export function parkingBay(index) { return [-70 + (index % 16) * 4.1, 0, index < 16 ? 73 : 95]; }
export function arrivalPose(index, day) {
    const bay = parkingBay(index), arrival = clamp((day - .05 - index * .025) / .38);
    const route = [[100, 0, 111], [-2, 0, 111], [-2, 0, 84], [bay[0], 0, 84], bay];
    return { position: pathPoint(route, arrival), parked: arrival >= 1, visible: arrival > 0, arrival };
}
export function workLocation(task, progress, worker = 0) {
    if (task.id === 'survey') return [-53 + Math.sin(progress * Math.PI * 2) * 12, 0, 35 - progress * 50];
    if (task.id === 'clear') { const p=roadPoint(progress); return [p[0]+4,0,p[2]+4]; }
    if (task.id === 'grade') { const p = earthCycle(progress); return [p.cutPoint[0] - 2, 0, p.cutPoint[1] + 10]; }
    if (task.id === 'drain' || task.id === 'duct') { const stage=trenchStages(progress), z=task.id==='duct'?33.5:30;return [trenchX(stage.pipe) - 2, worker % 3 ? -1.3 : 0, z + (worker % 3 ? 0 : 3)]; }
    if (task.zone === 'a' || task.zone === 'b') {
        const x = task.zone === 'a' ? -28 : 30;
        if (task.id.endsWith('-slab')) { if(progress<.25){const footing=Math.min(9,Math.floor(progress/.25*10));return[x+(footing%2?18:-18),0,-23+Math.floor(footing/2)*10];} const pour = cycle(Math.max(0, (progress - .25) / .75), 10); return [x - 17 + pour.phase * 34, .6, -25 + pour.index * 4.8]; }
        if(task.id.endsWith('-fitout')){const rack=Math.min(47,Math.floor(progress*48));return[x-13+Math.floor(rack/8)*6,.6,-20+(rack%8)*4.7];}
        if (task.id.endsWith('-frame')) return [x + (worker % 2 ? 18 : -18), .6, -25 + Math.floor(progress * 5) * 11];
        return [x - 14 + worker % 5 * 6, .6, -18 + Math.floor(progress * 6) * 6];
    }
    return { utilities:[0,0,30], power:[-35,0,-34], cooling:[39,0,-34], access:[-47,0,45], yard:[-3,0,25] }[task.zone] || [0,0,25];
}
// Pedestrians use the southern walkway before entering a work front, avoiding completed halls.
export function pedestrianRoute(from, to) {
    if (Math.hypot(from[0]-to[0], from[2]-to[2]) < 10) return [from.slice(), to.slice()];
    const path = [from.slice()];
    if (from[2] > 60) path.push([from[0],0,84],[-76,0,84],[-76,0,64],[-48,0,64],[-48,0,45]);
    path.push([from[0],0,43],[to[0],0,43],to.slice());
    if (from[2] > 60) path.splice(path.length-3,1);
    return path;
}
export const roadPoint = progress => pathPoint([[-69,0,53],[-69,0,-53],[69,0,-53],[69,0,53],[-69,0,53]], progress);
