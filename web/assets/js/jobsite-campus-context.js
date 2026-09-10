import * as THREE from 'three';

// Context stays outside the active haul/worker compound. Outlines are a masterplan,
// not completed quantities; active structures remain owned by the work packages.
export function buildCampusContext(v,s) {
    v.campusContext={plots:[],deferred:[]};
    const model=v.model,context=v.campusContext,modern=s.modelRevision===2;
    if(!modern)return;
    const label=(name,x,z,width=24)=>v.activity.label(name,x,z,width);
    const road=(points,width=8,color=0x6c706c)=>{
        for(let i=1;i<points.length;i++){
            const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1];
            const m=v.box([width,.1,Math.hypot(dx,dz)],[(a[0]+b[0])/2,.02,(a[1]+b[1])/2],color);m.rotation.y=Math.atan2(dx,dz);
        }
    };
    const plot=(name,x,z,w,d)=>{
        for(const dx of [-w/2,w/2])for(const dz of [-d/2,d/2]){v.box([.18,1.2,.18],[x+dx,.6,z+dz],0xbda57a);v.box([1,.4,.04],[x+dx+.45,1,z+dz],0xcba159);}
        for(const dx of [-w/2,w/2])v.box([.3,.12,d],[x+dx,.08,z],0xc3b397);
        for(const dz of [-d/2,d/2])v.box([w,.12,.3],[x,.08,z+dz],0xc3b397);
        // Dashed outlines and a flat interior distinguish reserved land from an erected shell.
        for(let j=-w/2+3;j<w/2;j+=7)v.box([3,.08,.25],[x+j,.13,z],0xc9ba9b);
        label(name,x,z,Math.min(w,27));context.plots.push({name,x,z,w,d});
    };
    const trees=(x,z,count,axis='x')=>{for(let i=0;i<count;i++){const px=x+(axis==='x'?i*7:0),pz=z+(axis==='z'?i*7:0);v.cyl(.35,4,[px,2,pz],0x79644e);v.shape(new THREE.ConeGeometry(2.8,8,6),i%2?0x5c6b50:0x657759,[px,7,pz]);}};
    const pond=(x,z,w,d)=>{v.box([w+4,.25,d+4],[x,-.2,z],0x9a957d);v.box([w,.08,d],[x,-.03,z],0x62898c);};
    const station=(x,z,cols=4)=>{
        v.box([cols*8+7,.4,21],[x,.1,z],0xa8a596);
        for(let i=0;i<cols;i++){
            const px=x+(i-(cols-1)/2)*8;v.box([4,3.6,4],[px,2,z],0x7c8987);
            for(const offset of [-1.3,1.3])v.cyl(.24,2,[px+offset,4.6,z],0xb7b7a7);
            v.box([.35,8,.35],[px,4,z-7],0x89958f);v.box([7,.25,.25],[px,8,z-7],0x919b94);
        }
        label('ELECTRICAL PRECINCT / CONTEXT',x,z-15,30);
    };
    const tanks=(x,z,rows=2,count=5)=>{
        v.box([count*5+7,.25,rows*8+5],[x,.05,z],0xaaa99c);
        for(let row=0;row<rows;row++)for(let i=0;i<count;i++){
            const px=x+(i-(count-1)/2)*5,pz=z+(row-(rows-1)/2)*8;
            const tank=v.cyl(1.7,6,[px,2.5,pz],0xd4d6cb,v.root,12);tank.rotation.x=Math.PI/2;
            for(const dz of [-2,2])v.box([3.8,1.4,.5],[px,.8,pz+dz],0x8e938d);
        }
    };
    // Permanent buildings acquire details with their own enclosure package.
    context.facades=v.halls.map(h=>{
        const g=v.group(h.g),fab=s.site==='terafab',f=model.fronts.find(f=>f.key===h.key);
        if(s.site!=='starbase'){
            const color={stratos:0x9caaac,abilene:0xa4afb0,saline:0xc3beb0,'dona-ana':0xb8a486,indiana:0x939da2,terafab:0xd3d7d3}[s.site];
            for(const side of [-1,1]){
                v.box([.15,1.3,43],[side*20.15,f.height-1.2,0],color,g);
                for(let z=-20;z<22;z+=4)v.box([.12,f.height,.12],[side*20.22,f.height/2,z],0x7c8785,g);
                if(s.site==='abilene'||s.site==='indiana')for(let z=-18;z<21;z+=8){v.box([.18,2.6,4],[side*20.25,2,z],0x454f50,g);}
            }
            if(fab){
                for(let z=-18;z<=18;z+=6){v.cyl(.65,5,[-14,f.height+2,z],0xa5afad,g);v.box([3,1.5,4],[12,f.height+1,z],0xb2bbb9,g);}
                v.box([34,.25,1.3],[0,f.height-2.5,19],0x628286,g);
            }
        }
        return{key:h.key,g};
    });
    const activeLabels=model.fronts.map(f=>label(f.name.toUpperCase(),f.x,24,22));
    context.activeLabels=activeLabels;
    switch(model.context){
    case 'launch': {
        road([[-250,-85],[120,-85],[145,-76]],9);label('STATE HIGHWAY 4',-10,-89,30);
        road([[-64,-81],[-64,-55]],8);road([[64,-81],[64,-53]],8);
        tanks(-4,-66,1,10);label('SHARED TANK FARM / CONTEXT',-4,-71,33);
        tanks(-103,-50,2,3);label('WATER + AIR SYSTEMS',-105,-36,25);
        v.box([66,4,1.4],[-5,2,-59],0xb5b19f);label('BLAST PROTECTION',-5,-56,23);
        pond(-115,0,26,18);pond(107,10,20,14);
        // Tide flats and a dune belt establish the eastern shoreline, without a desert photo sky.
        v.box([65,.1,380],[145,-.1,-30],0xb6ae8e);
        for(let i=0;i<18;i++){const dune=v.shape(new THREE.SphereGeometry(1,8,5),0xc3b99a,[143+i%3*7,-.1,-180+i*20]);dune.scale.set(12,2.5,17);dune.castShadow=false;}
        for(let i=0;i<8;i++)pond(-160-i%3*14,-100+i*26,14,10);
        v.box([44,.14,20],[-64,0,-112],0x72756d);label('PUBLIC EXHIBIT PARKING',-64,-122,28);
        label('MANUFACTURING / WEST OFF-SITE',-202,-87,38);
        label('COASTAL WETLANDS',106,64,28);
        break;
    }
    case 'eight':
        for(let row=0;row<3;row++)for(let col=0;col<2;col++)plot('BUILDING '+(3+row*2+col)+' / CONTEXT',col?30:-28,-93-row*68,28,44);
        road([[-62,51],[-62,-254],[64,-254],[64,51]]);road([[1,-60],[1,-254]],7);station(121,-117,5);pond(-113,-100,28,65);
        label('EIGHT-BUILDING PROGRAM',0,-271,42);break;
    case 'three':
        plot('BUILDING 3 / CONTEXT',-117,-3,26,46);road([[-151,40],[-151,-73],[70,-73]],8);station(22,-103,5);
        trees(-150,-130,30);trees(-157,-123,24,'z');pond(-95,-101,35,28);
        v.box([22,.3,16],[-113,.1,55],0xa19b88);for(const x of [-119,-113,-107])v.cyl(2,10,[x,5,55],0xb6b5a6);label('TEMPORARY BATCH PLANT',-113,67,27);
        label('SCREENED CAMPUS EDGE',-74,-131,35);break;
    case 'four':
        for(let i=0;i<2;i++)plot('BUILDING '+(i+3)+' / CONTEXT',i?30:-28,-102,36,36);
        road([[-68,51],[-68,-133],[70,-133],[70,51]],8);
        v.box([49,.15,86],[-111,.02,-62],0xada58c);
        for(let row=0;row<8;row++)for(let col=0;col<4;col++)v.box([6,2.6,3.2],[-128+col*11,1.4,-97+row*10],0xb7bfc0);
        label('FUEL-CELL MICROGRID / CONTEXT',-111,-113,38);pond(116,-90,38,30);break;
    case 'grid':
        for(let row=0;row<2;row++)for(let col=0;col<2;col++)plot('EXPANSION / CONCEPT',col?30:-28,-88-row*56,38,28);
        road([[-70,51],[-70,-176],[70,-176],[70,51]],9);station(119,-75,5);station(119,-137,5);road([[83,53],[83,-177]],7);
        trees(-110,-187,31);pond(-118,-60,30,50);label('MODULAR CAMPUS SECTOR',0,-193,38);break;
    case 'fab': {
        plot('FACTORY EXPANSION / CONCEPT',0,-125,110,74);road([[-78,-72],[-78,-181],[83,-181],[83,-72]],8);station(122,-122,5);tanks(-116,-120,2,5);
        label('PROCESS WATER + GAS / CONCEPT',-117,-141,35);
        const bridge=v.group();v.box([18,4,8],[1,11,-3],0xc3ccc8,bridge);for(const z of [-7,1])v.box([18,1.2,.12],[1,11,z],0x587379,bridge);
        context.deferred.push({g:bridge,tasks:['a-mep','b-mep']});label('INTEGRATED FAB / CONCEPT',0,-185,38);break;
    }
    case 'energy':
        plot('FUTURE PHASE / CONCEPT',-28,-109,40,44);plot('FUTURE PHASE / CONCEPT',30,-109,40,44);
        road([[-73,-57],[-73,-154],[73,-154],[73,-57]],8);station(-121,-66,4);tanks(119,-82,2,4);
        for(let i=0;i<3;i++){v.box([16,7,10],[-145+i*20,3.5,-119],0x969c8c);v.cyl(1.1,16,[-141+i*20,8,-120],0xc0bdb1);}
        label('ENERGY PRECINCT / CONCEPT',-122,-143,36);label('WATER PRECINCT / CONCEPT',118,-103,34);
        label('OPEN LAND / PHASED DEVELOPMENT',0,-179,44);break;
    }
    v.canvas.dataset.contextPlots=context.plots.length;
}
export function updateCampusContext(v,s) {
    const c=v.campusContext;if(!c)return;
    for(const {key,g} of c.facades||[])g.visible=s.tasks[key+'-envelope'].progress>=1&&!v.cutaway;
    for(const {g,tasks} of c.deferred)g.visible=tasks.every(id=>s.tasks[id].accepted);
}
