import * as THREE from 'three';
import { clamp, mix, smooth, cycle, earthCycle, earthHeight, earthProfile, trenchStages, trenchX, trenchDepth, armAngles, parkingBay, arrivalPose, workLocation, pedestrianRoute, pathPoint, roadPoint } from './jobsite-campus-activity.mjs';
const C = window.JobsiteCampus;
const DIRT = 0x92764e, STEEL = 0x414b4e, YELLOW = 0xe5b548;
const progress = (s, id) => s.tasks[id]?.progress || 0;

export class CampusActivity {
    constructor(view, state) {
        this.v = view; this.clock = state.day * 12; this.workIndex = 0; this.terrainKey = ''; this.people = [];
        this.terrain = view.shape(new THREE.PlaneGeometry(154, 122, 77, 61).rotateX(-Math.PI / 2), DIRT, [0, 0, 0]);
        this.terrain.material = view.groundMaterial; this.terrain.castShadow = false;
        this.buildParking(); this.buildPeople();
        this.excavators = [this.excavator(), this.excavator()];
        this.trucks = [this.truck(), this.truck(), this.truck(), this.truck()];
        this.dozers = [this.dozer(), this.dozer()]; this.roller = this.dozer(true);
        this.utilityExcavator = this.excavator(); this.backhoe = this.excavator(.78); this.pipeCarrier = this.group();
        const pipe = view.cyl(.3, 4.3, [0, 0, 0], 0x5f858d, this.pipeCarrier); pipe.rotation.z = Math.PI / 2;
        this.trenchBox = this.group();
        for (const z of [-1.32, 1.32]) view.box([8, 1.9, .18], [0, -.35, z], 0x9badae, this.trenchBox, .5);
        for (const x of [-3, 3]) view.beam([x,.4,-1.32],[x,.4,1.32],.18,STEEL,this.trenchBox);
        this.spoil = Array.from({length:24},(_,i)=>{const g=this.group();const m=view.shape(new THREE.ConeGeometry(2.1,1.4,7),DIRT,[0,.55,0],g);m.scale.set(1.2,1,.65);g.position.set(-55.6+i*4.8,0,35);return g;});
        this.bedding = Array.from({length:24},(_,i)=>view.box([4.6,.15,2.6],[-55.6+i*4.8,-1.5,30],0xb9a67f));
        this.pipes = [30,33.5].map(z=>Array.from({length:24},(_,i)=>{const m=view.cyl(z===30?.32:.23,4.7,[-55.6+i*4.8,-1.05,z],z===30?0x628c95:0xbaa674,view.root);m.rotation.z=Math.PI/2;return m;}));
        this.pumps = Array.from({length:3},()=>this.pump());
        this.lifts = Array.from({length:6},()=>this.lift());
        this.survey = this.group();
        for(const x of [-.7,.7])view.beam([x,0,.6],[0,1.7,0],.07,0xe8bd59,this.survey);
        view.beam([0,0,-.7],[0,1.7,0],.07,0xe8bd59,this.survey);view.box([.45,.4,.35],[0,1.9,0],0xe5dfd0,this.survey);
        this.rod = this.group();view.box([.09,3,.09],[0,1.5,0],0xf2e1c0,this.rod);
        for(let y=.25;y<3;y+=.5)view.box([.1,.18,.1],[0,y,0],0xb94f32,this.rod);
        this.buildRoadWork(); this.update(state, 0, C.allocation(state).active);
    }
    group(parent = this.v.root, x = 0, y = 0, z = 0) { return this.v.group(parent,x,y,z); }
    label(text, x, z, width = 14) {
        const c=document.createElement('canvas');c.width=512;c.height=96;const ctx=c.getContext('2d');
        ctx.fillStyle='#1d1914';ctx.fillRect(0,0,512,96);ctx.strokeStyle='#bb9871';ctx.lineWidth=4;ctx.strokeRect(2,2,508,92);ctx.fillStyle='#efe8dd';ctx.font='600 25px system-ui';ctx.textAlign='center';ctx.fillText(text,256,59);
        const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
        const material=new THREE.SpriteMaterial({map:texture,depthTest:true});const sign=new THREE.Sprite(material);sign.position.set(x,4,z);sign.scale.set(width,width*96/512,1);this.v.root.add(sign);
        (this.labels ||= []).push({texture,material});return sign;
    }
    buildParking() {
        const v=this.v;
        v.box([77,.25,34],[-39,.01,84],0x67635b);v.box([170,.14,7],[12,-.15,111],0x666963);
        v.box([7,.15,33],[-2,-.12,97],0x67635b);
        // Visitor parking and the pedestrian gate are separated from the east haul entrance.
        for(let i=0;i<32;i++){
            const [x,,z]=parkingBay(i);v.box([.1,.03,7],[x-1.95,.16,z],0xe1d5b5);v.box([3.9,.03,.1],[x,.16,z+(i<16?-3.5:3.5)],0xe1d5b5);
            v.box([2,.18,.3],[x,.2,z+(i<16?-2.5:2.5)],0xbeb7a3);
        }
        v.box([3,.14,42],[-77,.12,77],0xc9c0a4);v.box([31,.14,3],[-62,.12,64],0xc9c0a4);v.box([3,.14,20],[-48,.12,53],0xc9c0a4);
        for(let z=49;z<57;z+=1.4)v.box([4,.025,.65],[-48,.17,z],0xe6dbb6);
        for(let z=65;z<100;z+=5)v.cyl(.15,1.1,[-74.7,.55,z],YELLOW);
        this.label('CREW PARKING / 32 BAYS',-37,100,12);this.label('CHECK IN',-49,44,9);
        for(let i=0;i<3;i++){const x=-46+i*10;v.box([7,.22,4],[x,2.4,47],0x8d9486);for(const dx of [-3,3])v.box([.1,2.5,.1],[x+dx,1.2,47],0x5a605b);v.box([5,.15,1.2],[x,.85,47],0xb2a27b);}
        this.cars=Array.from({length:32},(_,i)=>this.truck('car',i));
    }
    buildRoadWork() {
        this.roadTiles=Array.from({length:64},(_,i)=>{
            const p=roadPoint((i+.5)/64),q=roadPoint(Math.min(1,(i+.501)/64));const tile=this.v.box([7,.13,7.8],[p[0],.025,p[2]],0x928978);tile.rotation.y=Math.atan2(q[0]-p[0],q[2]-p[2]);return tile;
        });
        this.dust=new THREE.InstancedMesh(new THREE.SphereGeometry(.35,5,4),new THREE.MeshBasicMaterial({color:0xc3af84,transparent:true,opacity:.24,depthWrite:false}),18);this.dust.frustumCulled=false;this.v.root.add(this.dust);this.dustMatrix=new THREE.Object3D();
    }
    truck(kind = 'haul', index = 0) {
        const v=this.v,g=this.group(),wheels=[];const car=kind==='car',sedan=car&&index%4!==0;
        const color=car?[0xe0d9c9,0x455261,0xb8b3a5,0x775546,0x8d9398][index%5]:0xe2d5aa;
        v.box([car?2:2.8,.5,car?4.3:6.6],[0,.7,0],car?color:STEEL,g,.3);
        v.box([car?1.85:2.65,sedan?.75:1.2,2.4],[0,sedan?1.25:1.45,car?-.25:-2],color,g,.3);
        v.box([car?1.5:2.3,sedan?.48:.72,.12],[0,sedan?1.3:1.7,car?-1.5:-3.25],0x31454d,g,.4);
        v.box([car?1.7:2.8,.12,car?2:2.7],[0,sedan?1.66:2.1,car?-.1:-2],car?color:0xe6dfcd,g);
        for(const x of [car?-1.03:-1.53,car?1.03:1.53])for(const z of [car?-1.3:-2.3,car?1.3:2.3]){const tire=v.cyl(car?.43:.65,.35,[x,.52,z],0x262b2d,g);tire.rotation.z=Math.PI/2;wheels.push(tire);v.cyl(.2,.37,[x,.52,z],0x9b9a91,g).rotation.z=Math.PI/2;}
        const bed=this.group(g,0,1.1,3.1);
        if(!car){v.box([2.7,.25,4.7],[0,0,-2.3],0xc3b393,bed);for(const x of [-1.4,1.4])v.box([.17,1.3,4.7],[x,.55,-2.3],0xc3b393,bed);v.box([2.8,1.3,.16],[0,.55,0],0xc3b393,bed);}
        const load=car?null:v.box([2.5,.75,4.3],[0,.5,-2.3],DIRT,bed);
        return {g,bed,load,wheels,kind};
    }
    excavator(scale = 1) {
        const v=this.v,g=this.group(),upper=this.group(g,0,1.2,0);
        for(const x of [-1.55,1.55]){v.box([.85,1.05,5.3],[x,.6,0],0x343b3a,g);for(let z=-2.2;z<=2.2;z+=.55){const wheel=v.cyl(.42,.9,[x,.58,z],0x717467,g);wheel.rotation.z=Math.PI/2;v.box([.93,.08,.22],[x,1.12,z],0x96917c,g);}}
        v.cyl(1.45,.45,[0,.1,0],0x525b55,upper);v.box([3.2,1.5,3.8],[0,1,0],YELLOW,upper);v.box([1.35,1.8,1.8],[.8,2,-.8],0xc4cfca,upper);v.box([1.2,1.1,.1],[.8,2.15,-1.76],0x324e5a,upper);v.box([.12,.8,.8],[1.51,2.15,-.8],0x324e5a,upper);
        const boom=this.group(upper,-.55,1.65,-.4),stick=this.group(boom,0,0,-5),bucket=this.group(stick,0,0,-4);
        v.box([.65,.65,5],[0,0,-2.5],YELLOW,boom);v.box([.44,.48,4],[0,0,-2],0xe7bb51,stick);
        v.box([.17,.18,3.8],[0,.48,-2.2],0xd0cbb7,boom,.8);v.box([.12,.14,2.5],[0,.36,-1.5],0xd0cbb7,stick,.8);
        v.box([1.55,.2,1.25],[0,-.32,-.2],0x59625b,bucket);for(const x of [-.7,.7])v.box([.14,.8,1.25],[x,0,-.2],0x59625b,bucket);
        for(let x=-.6;x<=.6;x+=.3)v.box([.13,.18,.45],[x,-.3,-.95],0xb0ad91,bucket);
        const soil=v.box([1.15,.55,.95],[0,-.06,-.2],DIRT,bucket);g.scale.setScalar(scale);
        return {g,upper,boom,stick,bucket,soil,scale};
    }
    poseExcavator(m, position, target, filled, tip = 0) {
        m.g.position.set(...position);const dx=(target[0]-position[0])/m.scale,dz=(target[2]-position[2])/m.scale;
        m.upper.rotation.y=Math.atan2(-dx,-dz);const angles=armAngles(Math.hypot(dx,dz)-.4,(target[1]-position[1])/m.scale-2.85);
        m.boom.rotation.x=angles.shoulder;m.stick.rotation.x=angles.elbow;m.bucket.rotation.x=-angles.shoulder-angles.elbow+tip;m.soil.visible=filled;
    }
    dozer(roller = false) {
        const v=this.v,g=this.group();v.box([3.1,.8,4.8],[0,.7,0],STEEL,g);v.box([2.5,1.1,2.8],[0,1.6,0],YELLOW,g);v.box([1.8,1.6,1.7],[0,2.7,.4],0xbfc9c1,g);v.box([1.7,.9,.1],[0,2.9,-.5],0x35515c,g);
        const blade=v.box([4.2,1.35,.4],[0,.7,-2.6],0xe0bf76,g);
        for(const x of [-1.65,1.65])v.box([.7,1,4.6],[x,.6,0],0x3a403e,g);
        if(roller){blade.visible=false;v.cyl(1,3.8,[0,.9,-2.3],0x858678,g,20).rotation.z=Math.PI/2;}
        const dirt=v.shape(new THREE.ConeGeometry(1.5,.8,7),DIRT,[0,.25,-3.4],g);dirt.scale.set(1.5,1,.45);
        return {g,blade,dirt};
    }
    pump() {
        const v=this.v,truck=this.truck(),mixer=this.truck(),boom=this.group(truck.g);
        truck.bed.visible=false;mixer.bed.visible=false;
        const drum=v.shape(new THREE.CylinderGeometry(1.35,.95,3.4,16).rotateX(Math.PI/2),0xdfd8c8,[0,2.1,.5],mixer.g);
        v.box([.14,.18,3.1],[1.22,0,0],YELLOW,drum);
        const arms=[0,1,2].map(()=>v.box([.2,.2,1],[0,0,0],0xd0b570,boom));
        const hose=v.box([.12,1,.12],[0,0,0],0x343b3c,boom);
        for(const x of [-2.5,2.5])v.box([2.7,.18,.25],[x,.45,0],0x78807a,truck.g);
        return {truck,mixer,boom,drum,arms,hose};
    }
    lift() {
        const v=this.v,g=this.group();v.box([2,.65,3],[0,.4,0],YELLOW,g);const arm=v.box([.2,5,.2],[0,2.8,0],STEEL,g);const platform=this.group(g,0,5.4,0);v.box([2.1,.15,1.5],[0,0,0],0x8a8e7a,platform);for(const x of [-1,1])v.box([.06,1,.06],[x,.5,0],YELLOW,platform);v.box([2.1,.06,.06],[0,1,.7],YELLOW,platform);return {g,arm,platform};
    }
    buildPeople() {
        const v=this.v, max=225;
        this.parts={};
        for(const [key,geometry,color] of [
            ['body',new THREE.BoxGeometry(.52,.7,.32),0xe8b23f],['band',new THREE.BoxGeometry(.55,.12,.34),0xe4e1ba],
            ['head',new THREE.SphereGeometry(.21,8,6),0xbe916f],['hat',new THREE.CylinderGeometry(.24,.28,.17,10),0xf0df9b],
            ['leftLeg',new THREE.BoxGeometry(.19,.72,.22),0x33444e],['rightLeg',new THREE.BoxGeometry(.19,.72,.22),0x33444e],
            ['leftArm',new THREE.BoxGeometry(.15,.63,.18),0xd6a341],['rightArm',new THREE.BoxGeometry(.15,.63,.18),0xd6a341]
        ]){const mesh=new THREE.InstancedMesh(geometry,v.mat(color),max);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.castShadow=true;mesh.frustumCulled=false;v.root.add(mesh);this.parts[key]=mesh;}
        this.dummy=new THREE.Object3D();this.person=new THREE.Object3D();this.limb=new THREE.Object3D();
        let id=0;
        for(const [trade,info] of Object.entries(C.TRADES))for(let crew=0;crew<3;crew++)for(let member=0;member<info.people;member++)this.people.push({id:id++,trade,crew,member,position:null,target:null,route:null,walked:0,key:''});
    }
    movePerson(person, target, key, dt, s) {
        if(!person.position){person.position = s.day>1.4 || person.trade==='survey' ? target.slice() : parkingBay(person.car||0).map((v,i)=>i===0?v+1.5:v);person.target=person.position.slice();person.key='arrival';}
        if(person.key!==key || Math.hypot(target[0]-person.target[0],target[2]-person.target[2])>5){person.route=pedestrianRoute(person.position,target);person.walked=0;person.target=person.position.slice();person.key='arrival';}
        if(!person.route && Math.hypot(target[0]-person.position[0],target[2]-person.position[2])>.8){person.route=[person.position.slice(),target.slice()];person.walked=0;person.target=target.slice();}
        let walking=false;
        if(person.route && s.running){
            const remaining=Math.hypot(...person.route[1].map((v,i)=>v-person.position[i]));const step=dt*s.speed*5.5;
            const next=remaining<=step?person.route[1].slice():person.position.map((v,i)=>v+(person.route[1][i]-v)*step/remaining);
            person.yaw=Math.atan2(next[0]-person.position[0],next[2]-person.position[2]);person.position=next;walking=true;
            if(remaining<=step){person.route.shift();if(person.route.length<2)person.route=null;}
        }
        return walking;
    }
    updatePeople(s,dt,active) {
        let count=0,walkingCount=0,workingCount=0,employee=0;
        const assigned={};for(const t of active)(assigned[t.trade] ||= []).push(t);
        for(const person of this.people){
            if(person.crew>=s.crews[person.trade])continue;
            person.car=Math.min(31,Math.floor(employee++/4));const task=assigned[person.trade]?.[person.crew];const arrived=arrivalPose(person.car,s.day).parked || person.trade==='survey';
            if(!arrived)continue;
            let target=task?workLocation(task,progress(s,task.id),person.member):[-48+person.id%13*2.4,0,45+Math.floor(person.id%39/13)*2.1];
            if(task){target=[target[0]+(person.member%3-1)*1.1,target[1],target[2]+Math.floor(person.member/3)*1.1];if(task.id==='grade'){const e=this.earth[person.member%2];if(person.member<2)target=[e.machine[0]+.8,1.7,e.machine[2]-.6];else if(person.member<4)target=[e.truck[0],.2,e.truck[2]-2];}}
            const seated=task?.id==='grade'&&person.member<4;
            if(seated){person.position=target.slice();person.target=target.slice();person.route=null;person.key=task.id;}
            const walking=seated?false:this.movePerson(person,target,task?.id||'break',dt,s);if(walking)walkingCount++;if(task)workingCount++;
            const p=person.position.slice();if(!seated&&p[1]>=0&&p[2]<40&&Math.abs(p[0])<76){p[1]=Math.max(p[1],earthHeight(p[0],p[2],progress(s,'grade')));}
            this.person.position.set(...p);this.person.rotation.set(0,person.yaw||0,0);this.person.updateMatrix();
            if(s.running){person.gait=walking?Math.sin(this.clock*8+person.id)*.6:0;person.work=task&&!walking&&!seated?Math.sin(this.clock*4+person.id)*.25:0;}const gait=person.gait||0,work=person.work||0;
            const poses={body:[0,1.13,0,0],band:[0,1.2,0,0],head:[0,1.69,0,0],hat:[0,1.89,0,0],leftLeg:[-.15,.42,0,gait],rightLeg:[.15,.42,0,-gait],leftArm:[-.36,1.1,0,-gait+work],rightArm:[.36,1.1,0,gait-work]};
            for(const [key,[x,y,z,angle]] of Object.entries(poses)){this.limb.position.set(x,y,z);this.limb.rotation.set(angle,0,0);this.limb.updateMatrix();this.dummy.matrix.multiplyMatrices(this.person.matrix,this.limb.matrix);this.parts[key].setMatrixAt(count,this.dummy.matrix);}
            count++;
        }
        for(const mesh of Object.values(this.parts)){mesh.count=count;mesh.instanceMatrix.needsUpdate=true;}
        this.workerCount=count;this.walkingCount=walkingCount;this.workingCount=workingCount;
    }
    placeVehicle(model, point, ahead) {
        model.g.position.set(...point);if(ahead&&Math.hypot(ahead[0]-point[0],ahead[2]-point[2])>.001)model.g.rotation.y=Math.atan2(-(ahead[0]-point[0]),-(ahead[2]-point[2]));
        for(const wheel of model.wheels||[])wheel.rotation.x=this.clock*2;
    }
    terrainUpdate(s) {
        const grade=progress(s,'grade'),drain=progress(s,'drain'),duct=progress(s,'duct'),key=[grade,drain,duct].map(p=>p.toFixed(3)).join(':');if(key===this.terrainKey)return;this.terrainKey=key;
        const vertices=this.terrain.geometry.attributes.position,profile=earthProfile(grade);
        if(!this.terrainWeights)this.terrainWeights=Array.from({length:vertices.count},(_,i)=>profile.map(c=>[Math.exp(-((vertices.getX(i)-c.cut[0])**2/75+(vertices.getZ(i)-c.cut[1])**2/30))*1.8,Math.exp(-((vertices.getX(i)-c.fill[0])**2/100+(vertices.getZ(i)-c.fill[1])**2/36))*1.05]));
        for(let i=0;i<vertices.count;i++){const x=vertices.getX(i),z=vertices.getZ(i),height=profile.reduce((h,c,j)=>h+this.terrainWeights[i][j][0]*c.cutRemaining-this.terrainWeights[i][j][1]*c.fillRemaining,-.08);vertices.setY(i,height+trenchDepth(x,z,drain,30)+trenchDepth(x,z,duct,33.5));}
        vertices.needsUpdate=true;this.terrain.geometry.computeVertexNormals();this.terrain.geometry.computeBoundingSphere();
    }
    update(s,dt,active) {
        if(s.running)this.clock+=dt*s.speed;
        this.active=active;this.terrainUpdate(s);const v=this.v;
        const earthTask=active.find(t=>t.equipment==='earth'),trenchTask=active.find(t=>t.equipment==='trench');
        this.earth=[earthCycle(progress(s,'grade'),0),earthCycle(progress(s,'grade'),1)];
        this.excavators.forEach((m,i)=>{const e=this.earth[i],working=earthTask?.id==='grade';m.g.visible=s.equipment.earth>0;this.poseExcavator(m,working?[e.machine[0],earthHeight(e.machine[0],e.machine[2],progress(s,'grade')),e.machine[2]]:[57+i*7,0,34],working?e.bucket:[53+i*7,1,30],working&&e.soil,e.phase>.43&&e.phase<.5?-.8:0);});
        this.trucks.forEach((truck,i)=>{truck.g.visible=s.equipment.earth>0;const e=this.earth[i%2],working=earthTask?.id==='grade'&&i<2;const point=working?e.truck:[57+(i%2)*7,0,17+Math.floor(i/2)*10];const ahead=working?earthCycle(Math.min(1,progress(s,'grade')+.0002),i%2).truck:null;if(working)point[1]=earthHeight(point[0],point[2],progress(s,'grade'));this.placeVehicle(truck,point,ahead);truck.bed.rotation.x=working?e.tip:0;truck.load.visible=working&&e.payload>0;});
        [...this.dozers,this.roller].forEach((m,i)=>{m.g.visible=s.equipment.earth>0;if(earthTask?.id==='grade'){const e=this.earth[i%2];const pass=clamp((e.phase-.74)/.26);m.g.position.set(e.fillPoint[0]-6+pass*12,0,e.fillPoint[1]+(i===2?9:1));m.g.position.y=earthHeight(m.g.position.x,m.g.position.z,progress(s,'grade'));m.g.rotation.y=-Math.PI/2;m.dirt.visible=e.phase>.73&&e.phase<.92&&i<2;}else if(earthTask){const p=clamp(progress(s,earthTask.id)-i*.015),a=roadPoint(p),b=roadPoint(Math.min(1,p+.002));this.placeVehicle(m,a,b);m.dirt.visible=i<2&&earthTask.id==='clear';}else{m.g.position.set(57+i*6,0,45);m.dirt.visible=false;}});
        this.roadTiles.forEach((tile,i)=>{tile.visible=i/64<progress(s,'clear');tile.material=v.mat(i/64<progress(s,'roads')?0x44494b:0x928978);});
        this.updateTrench(s,trenchTask);this.updatePumps(s,active);this.updateLifts(s,active);
        const cars=Math.min(32,Math.ceil(Object.entries(s.crews).reduce((n,[k,c])=>n+c*C.TRADES[k].people,0)/4));let parked=0;
        this.cars.forEach((car,i)=>{const pose=arrivalPose(i,s.day);car.g.visible=i<cars&&(pose.visible||s.day>1.5);if(car.g.visible){const ahead=arrivalPose(i,s.day+.001).position;this.placeVehicle(car,pose.position,ahead);if(pose.parked){car.g.rotation.y=i<16?0:Math.PI;parked++;}}});this.parkedCount=parked;
        const survey=active.find(t=>t.trade==='survey');this.survey.visible=this.rod.visible=!!survey;if(survey){const p=workLocation(survey,progress(s,survey.id));this.survey.position.set(p[0]-2,0,p[2]);this.rod.position.set(p[0]+5,0,p[2]-4);}
        this.updatePeople(s,dt,active);
        const dustActive=s.running&&earthTask?.id==='grade';this.dust.visible=dustActive;if(dustActive)for(let i=0;i<18;i++){const e=this.earth[i%2],a=(this.clock*.8+i*.37)%1;this.dustMatrix.position.set(e.truck[0]+Math.sin(i)*1.5,.4+a*2,e.truck[2]+a*4);this.dustMatrix.scale.setScalar(.3+a);this.dustMatrix.updateMatrix();this.dust.setMatrixAt(i,this.dustMatrix.matrix);}this.dust.instanceMatrix.needsUpdate=true;
        const focusTask=active[this.workIndex%Math.max(1,active.length)];this.focus=focusTask?workLocation(focusTask,progress(s,focusTask.id)):[-40,0,77];
        if(focusTask?.id==='grade'){const e=this.earth[0];this.focus=e.phase>.5?e.truck.slice():[e.machine[0]+3,0,e.machine[2]+3];}
        if(focusTask&&(focusTask.equipment==='crane'||focusTask.equipment==='pump')&&['a','b'].includes(focusTask.zone)){this.focus=[(focusTask.zone==='a'?-28:30)+5,focusTask.equipment==='crane'?5:0,this.focus[2]];}
        if(focusTask?.id==='a-frame'&&C.site(s.site).type==='space')this.focus=[-36,progress(s,'a-frame')*52,0];
        this.focusTask=focusTask;this.title=focusTask?focusTask.name:s.day<1.5?'Morning mobilization':'Crews at the site compound';
        this.detail=focusTask?.id==='grade'?this.earth[0].label:trenchTask&&focusTask===trenchTask?'Excavate / bed and set pipe / backfill in sequence':focusTask?.equipment==='crane'?'Rig / hoist / set / release':focusTask?.equipment==='pump'?'Form and reinforce / pump concrete / finish the slab':focusTask?'Assigned crews at the work front':'Park, check in and walk to the work area';
        v.canvas.dataset.visibleWorkers=this.workerCount;v.canvas.dataset.walkingWorkers=this.walkingCount;v.canvas.dataset.parkedCars=this.parkedCount;v.canvas.dataset.activityPhase=this.clock.toFixed(3);v.canvas.dataset.terrainVersion=this.terrainKey;
    }
    updateTrench(s,task) {
        const v=this.v,p=task?progress(s,task.id):progress(s,'duct')||progress(s,'drain'),z=task?.id==='duct'?33.5:30,st=trenchStages(p),phase=(p*27)%1;
        const dig=trenchX(st.dig),pipe=trenchX(st.pipe),fill=trenchX(st.fill);const working=!!task;
        this.utilityExcavator.g.visible=this.backhoe.g.visible=s.equipment.trench>0;
        this.poseExcavator(this.utilityExcavator,working?[dig,0,z-6]:[-61,0,42],working?[dig,mix(.2,-1.3,Math.sin(phase*Math.PI)**2),z]:[-57,1,38],working&&phase>.25&&phase<.7);
        this.poseExcavator(this.backhoe,working?[fill-2,0,z-6]:[-64,0,34],working?[fill-2,phase<.5?1.2:0,z+(phase<.5?4:0)]:[-59,1,32],working&&phase<.5);
        this.trenchBox.visible=working&&st.pipe>0&&st.fill<24;this.trenchBox.position.set(pipe-3,0,z);
        this.pipeCarrier.visible=working&&st.pipe>0&&st.pipe<24;this.pipeCarrier.position.set(pipe-2,mix(.5,-1.05,smooth(phase)),z);
        this.spoil.forEach((pile,i)=>{const state=trenchStages(progress(s,task?.id||'drain'));pile.visible=i<state.dig&&i>=state.fill;pile.position.z=z+(task?.id==='duct'?3.2:5);pile.scale.y=Math.max(.05,clamp(state.dig-i)*clamp(i-state.fill+1));});
        this.bedding.forEach((bed,i)=>{bed.visible=i<st.pipe;bed.position.z=z;});
        this.pipes.forEach((pieces,line)=>{const stage=trenchStages(progress(s,line?'duct':'drain'));pieces.forEach((piece,i)=>piece.visible=i+1<=stage.pipe);});
    }
    setBeam(mesh,a,b) {
        const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),delta=to.clone().sub(from);mesh.position.copy(from.add(to).multiplyScalar(.5));mesh.scale.set(1,1,delta.length());mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),delta.normalize());
    }
    updatePumps(s,active) {
        const tasks=active.filter(t=>t.equipment==='pump');
        this.pumps.forEach((p,i)=>{p.truck.g.visible=p.mixer.g.visible=i<tasks.length;if(!tasks[i])return;const task=tasks[i],amount=progress(s,task.id),target=workLocation(task,amount),x=task.zone==='a'?-2:57;this.placeVehicle(p.truck,[x,0,target[2]],null);this.placeVehicle(p.mixer,[x+1,0,target[2]+8],null);p.drum.rotation.z=this.clock*.8;
            const local=[target[0]-x,.8,0],points=[[0,3,0],[0,13,-3],[local[0]/2,15,0],[local[0],6,0]];p.arms.forEach((arm,j)=>this.setBeam(arm,points[j],points[j+1]));p.hose.position.set(local[0],3.4,0);p.hose.scale.y=5.2;p.boom.visible=amount>.25;
        });
    }
    updateLifts(s,active) {
        const tasks=active.filter(t=>t.equipment==='lift');this.lifts.forEach((lift,i)=>{const task=tasks[Math.floor(i/2)];lift.g.visible=!!task;if(!task)return;const p=workLocation(task,progress(s,task.id),i),height=C.site(s.site).type==='fab'?10:6;lift.g.position.set(p[0]+(i%2?4:-4),0,p[2]);lift.platform.position.y=height;lift.arm.scale.y=height/5;lift.arm.position.y=height/2;});
    }
    dispose() { for(const label of this.labels||[]){label.texture.dispose();label.material.dispose();}this.dust.material.dispose(); }
}
