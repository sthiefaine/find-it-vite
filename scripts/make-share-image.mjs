import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const background = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<defs><radialGradient id="bg" cx=".65" cy=".1" r="1"><stop stop-color="#7545bd"/><stop offset="1" stop-color="#240943"/></radialGradient><linearGradient id="board" x2="0" y2="1"><stop stop-color="#f8edcf"/><stop offset="1" stop-color="#dfcda6"/></linearGradient></defs>
<rect width="1200" height="630" fill="url(#bg)"/><circle cx="1090" cy="120" r="270" fill="#ba80ee" opacity=".09"/><circle cx="20" cy="590" r="290" fill="#ffd05a" opacity=".04"/>
<rect x="64" y="60" width="263" height="44" rx="22" fill="#9e5de7" stroke="#c790f8" stroke-width="2"/>
<g font-family="Trebuchet MS,Arial,sans-serif" font-weight="bold"><text x="85" y="89" font-size="21" letter-spacing="1" fill="#fff2cc">DUEL EN LIGNE</text>
<text x="62" y="263" font-size="148" letter-spacing="-10" fill="#190731" stroke="#190731" stroke-width="3">find</text><text x="356" y="263" font-size="148" letter-spacing="-10" fill="#97531c">it</text>
<text x="62" y="254" font-size="148" letter-spacing="-10" fill="#fff9ed">find</text><text x="356" y="254" font-size="148" letter-spacing="-10" fill="#ffc800">it</text>
<text x="70" y="344" font-size="43" fill="#fff3d4">Qui voit la cible</text><text x="70" y="401" font-size="43" fill="#fff3d4">en premier ?</text>
<rect x="70" y="459" width="503" height="68" rx="20" fill="#361459" stroke="#9160be" stroke-width="2"/>
<text x="93" y="502" font-size="23" fill="#f5dfaf">2 joueurs</text><text x="260" y="502" font-size="23" fill="#f5dfaf">3 vies</text><text x="397" y="502" font-size="23" fill="#f5dfaf">60 secondes</text></g>
<rect x="691" y="67" width="427" height="502" rx="39" fill="#19082e"/>
<rect x="683" y="57" width="427" height="502" rx="39" fill="url(#board)" stroke="#fff0c0" stroke-width="5"/>
<g fill="#ffdb67"><path d="M602 83l6 15 16 6-16 6-6 15-6-15-16-6 16-6z"/><path d="M1153 479l5 12 13 5-13 5-5 12-5-12-13-5 13-5z"/></g>
</svg>`);
const ids=[['animals','chien'],['animals','coq'],['celebrities','omar-sy'],['animals','panda'],['animals','chat'],['animals','capybara'],['animals','koala'],['animals','renard'],['celebrities','philippe-etchebest']];
const portraits=await Promise.all(ids.map(async([category,id],i)=>({input:await sharp(`public/assets/images/characters/${category}/${id}.png`).resize(108,120,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer(),left:709+(i%3)*128,top:98+Math.floor(i/3)*145})));
const ring=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><circle cx="891" cy="303" r="65" fill="none" stroke="#5c3592" stroke-width="9"/><circle cx="891" cy="303" r="65" fill="none" stroke="#ffce31" stroke-width="5"/><rect x="808" y="498" width="172" height="42" rx="21" fill="#7345b3"/><text x="894" y="526" text-anchor="middle" font-family="Trebuchet MS,Arial,sans-serif" font-size="19" font-weight="bold" fill="#fff2bf">À toi de jouer !</text></svg>`);
await mkdir('public/social',{recursive:true});
await sharp(background).composite([...portraits,{input:ring,top:0,left:0}]).jpeg({quality:90,mozjpeg:true}).toFile('public/social/find-it-duel.jpg');
console.log('public/social/find-it-duel.jpg (1200 × 630)');
