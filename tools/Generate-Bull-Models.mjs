import {writeFileSync} from 'node:fs';
import {brickModel} from './models/krill-bricks.mjs';
// Shared solid geometry and joint hierarchy for the Godot and Three.js renderers.
function model(){return {joints:[{id:'body',parent:null,pos:[0,0,0]}],parts:[]};}
function joint(m,id,parent,pos){m.joints.push({id,parent,pos});}
function part(m,j,shape,pos,size,color){m.parts.push({joint:j,shape,pos,size,color});}
function segment(m,j,from,to,r0,r1,color){m.parts.push({joint:j,shape:'segment',from,to,r0,r1,color});}
const bull=model(),human=model();
const black='#292a31',light='#41434d',dark='#17181d',horn='#f6e4bf',skin='#f4b881',hair='#593325';
part(bull,'body','ellipsoid',[0,1.42,-.15],[2.05,1.65,3.1],black);
part(bull,'body','ellipsoid',[0,1.85,.48],[1.95,1.45,1.8],light);
part(bull,'body','ellipsoid',[0,1.82,.12],[1.7,1.5,1.9],black);
part(bull,'body','ellipsoid',[0,1.05,.55],[1.85,1.15,1.5],dark);
joint(bull,'head','body',[0,1.55,1.18]);
part(bull,'head','ellipsoid',[0,0,.25],[1.25,1.15,1.35],black);
part(bull,'head','box',[0,.48,.07],[.85,.24,.62],light);
part(bull,'head','ellipsoid',[0,-.35,.92],[.95,.6,.7],'#62616a');
part(bull,'head','box',[0,-.49,1.03],[.75,.12,.42],dark);
for(const side of [-1,1]){
  part(bull,'head','box',[side*.28,-.3,1.25],[.17,.16,.065],'#0d0d10');
  part(bull,'head','ellipsoid',[side*.56,.07,.63],[.075,.19,.24],'#fbe5a3');
  part(bull,'head','box',[side*.58,.22,.55],[.14,.16,.38],dark);
  part(bull,'head','ellipsoid',[side*.78,.22,-.04],[.67,.23,.38],light);
  const path=[[side*.5,.4,.02],[side*.91,.45,.14],[side*1.25,.61,.26],[side*1.42,.95,.39],[side*1.39,1.3,.5]];
  for(let i=0;i<path.length-1;i++)segment(bull,'head',path[i],path[i+1],.25-i*.045,i===3?.012:.205-i*.045,i<1?'#bba37e':horn);
  for(const front of [true,false]){
    const id=`leg${side<0?'L':'R'}${front?'F':'B'}`;joint(bull,id,'body',[side*.75,1.24,front?.7:-1.13]);
    part(bull,id,'ellipsoid',[0,-.23,0],[.64,.9,.62],black);
    part(bull,id,'box',[0,-.76,.02],[.35,.68,.35],light);
    part(bull,id,'box',[0,-1.08,.13],[.52,.28,.64],dark);
    part(bull,id,'box',[0,-1.04,.41],[.41,.14,.11],'#55545b');
  }
}
joint(bull,'tail','body',[0,1.7,-1.57]);segment(bull,'tail',[0,0,0],[0,-.25,-.62],.08,.05,black);segment(bull,'tail',[0,-.25,-.62],[.2,-.65,-.77],.05,.07,black);part(bull,'tail','ellipsoid',[.2,-.7,-.78],[.25,.38,.24],dark);
part(human,'body','box',[0,1.52,0],[.77,.91,.46],'#ef332b');
part(human,'body','box',[0,1.73,-.24],[.61,.2,.025],'#fa5240');
part(human,'body','box',[0,1.11,0],[.8,.28,.49],'#164079');
part(human,'body','box',[0,1.03,.26],[.69,.09,.03],'#112c56');
part(human,'body','box',[0,2.06,0],[.3,.25,.3],skin);
joint(human,'head','body',[0,2.39,0]);
part(human,'head','box',[0,0,0],[.65,.65,.58],skin);
part(human,'head','box',[0,-.03,.34],[.15,.16,.18],'#d99860');
part(human,'head','box',[0,.31,-.025],[.73,.26,.65],hair);
part(human,'head','box',[-.22,.43,.02],[.28,.2,.54],'#784832');part(human,'head','box',[.22,.37,-.1],[.3,.25,.5],'#47271d');
part(human,'head','box',[-.29,.16,-.18],[.16,.32,.36],hair);
part(human,'head','box',[0,-.18,.302],[.3,.16,.028],'#48231c');part(human,'head','box',[0,-.13,.32],[.24,.045,.03],'#fff1df');
for(const side of [-1,1]){
  part(human,'head','box',[side*.16,.06,.303],[.2,.19,.032],'#fff5e8');part(human,'head','box',[side*.145,.04,.325],[.075,.13,.024],'#211a17');
  part(human,'head','box',[side*.16,.2,.322],[.24,.055,.055],hair);part(human,'head','box',[side*.36,-.01,0],[.13,.21,.22],skin);
  const suffix=side<0?'L':'R';joint(human,'arm'+suffix,'body',[side*.53,1.88,0]);
  part(human,'arm'+suffix,'box',[0,-.13,0],[.32,.36,.4],'#d72123');part(human,'arm'+suffix,'box',[0,-.46,0],[.23,.42,.24],skin);
  joint(human,'forearm'+suffix,'arm'+suffix,[0,-.65,0]);part(human,'forearm'+suffix,'box',[0,-.14,.19],[.23,.24,.48],skin);part(human,'forearm'+suffix,'box',[0,-.12,.43],[.28,.28,.28],skin);
  joint(human,'leg'+suffix,'body',[side*.22,1.04,0]);part(human,'leg'+suffix,'box',[0,-.28,0],[.34,.55,.4],'#245da1');
  joint(human,'shin'+suffix,'leg'+suffix,[0,-.53,0]);part(human,'shin'+suffix,'box',[0,-.22,0],[.3,.43,.34],'#17417b');part(human,'shin'+suffix,'box',[0,-.43,.12],[.4,.24,.64],'#ece4d5');part(human,'shin'+suffix,'box',[0,-.54,.12],[.42,.075,.66],'#4b4846');
}
writeFileSync(new URL('../game/bull-models.json',import.meta.url),JSON.stringify({schema:3,bull:brickModel(bull,.075),human:brickModel(human,.045)})+'\n');
console.log('Created articulated bull and human with stepped brick surfaces');
