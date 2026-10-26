#version 450
#extension GL_GOOGLE_include_directive : require
layout(location=0) out vec4 outColor;
#define STATE_ACCESS readonly
#include "launcher-state.glsl"
#define HB_READONLY
#include "hb.glsl"
#include "launcher-text.glsl"
#include "draw.glsl"
// Packed artwork (see launcher.cjs / replace-assets.py). The shared buffer is
// 24 MiB; bytes 0x7f0000..0x7fffff are SDK-owned by the host and stay clear.
// Words 2082560..4156159 (buffer byte 0x7f2000) hold a full-screen 1920x1080
// RGBA background; words 4156160..4252959 hold the 440x220 RGBA title plate.
const uint BG_WORD=2082560u,BG_W=1920u;
const uint PLATE_WORD=4156160u,PLATE_W=440u,PLATE_H=220u;
float catalogText(vec2 p,vec2 origin,uint index,bool description){
 ivec2 q=ivec2(floor(p-origin));uint base=524288u+index*32768u,meta=base+25600u;
 uint width=c.atlas[meta+(description?2u:0u)],height=c.atlas[meta+(description?3u:1u)];
 if(any(lessThan(p-origin,vec2(0)))||q.x>=int(width)||q.y>=int(height))return 0.0;
 uint pixel=uint(q.y+(description?64:0))*512u+uint(q.x),word=c.atlas[base+(pixel>>2u)];
 return float((word>>((pixel&3u)*8u))&255u)/255.0;
}
vec4 catalogIcon(vec2 p,vec2 center,uint index){
 ivec2 q=ivec2(floor((p-center+vec2(36))*96.0/72.0));
 if(any(lessThan(q,ivec2(0)))||any(greaterThanEqual(q,ivec2(96))))return vec4(0);
 return unpackUnorm4x8(c.atlas[524288u+index*32768u+16384u+uint(q.y*96+q.x)]);
}
// Soft drop shadow keeps text legible over the photographic background.
float shadowText(vec2 p,vec2 origin,ivec4 rect){return text(p+vec2(1.5,1.5),origin,rect)*.8;}
void main() {
    vec2 p=gl_FragCoord.xy;
    float t=c.motion.x;
    // Full-screen background artwork replaces the procedural waves.
    vec3 col=unpackUnorm4x8(c.atlas[BG_WORD+uint(p.y)*BG_W+uint(p.x)]).rgb;
    col=mix(col,vec3(.81,.96,1.0),text(p,vec2(164,75),TEXT_PLATFORM));
    // Title plate artwork (packed RGBA) replaces the old title glyphs.
    ivec2 lq=ivec2(floor(p-vec2(158.0,104.0)));
    if(lq.x>=0&&lq.y>=0&&lq.x<int(PLATE_W)&&lq.y<int(PLATE_H)){
        vec4 plate=unpackUnorm4x8(c.atlas[PLATE_WORD+uint(lq.y)*PLATE_W+uint(lq.x)]);
        col=mix(col,plate.rgb,plate.a);
    }
    col=mix(col,vec3(.05,.12,.2),shadowText(p,vec2(164,342),TEXT_SUBTITLE));
    col=mix(col,vec3(1),text(p,vec2(164,342),TEXT_SUBTITLE));
    // Soft dark discs keep the top-right controls legible over bright photo areas.
    col=mix(col,vec3(.08,.17,.26),(1.0-smoothstep(40.0,92.0,length(p-vec2(1660,179))))*.35);
    col=mix(col,vec3(.08,.17,.26),(1.0-smoothstep(40.0,92.0,length(p-vec2(1490,179))))*.35);
    // The refresh arrow stays still until a tap starts the mock refresh cycle.
    vec2 emblem=p-vec2(1660,179);
    col=mix(col,vec3(.70,.95,1),line(length(emblem)-65.0,1.2)*.60);
    float turn=c.refresh.y;
    vec2 arrow=mat2(cos(turn),-sin(turn),sin(turn),cos(turn))*emblem;
    float arc=line(length(arrow)-33.0,2.7)*smoothstep(-2.5,-2.42,atan(arrow.y,arrow.x));
    // An equilateral arrowhead follows the clockwise tangent at the end of the arc.
    vec2 tip=vec2(-33.0,0.0);
    vec2 local=arrow-tip;
    float head=fill(max(max(local.y-5.0,-local.y*.5+local.x*.866-5.0),-local.y*.5-local.x*.866-5.0));
    col=mix(col,vec3(1),max(arc,head)*.95);
    // Music on/off, beside refresh. The slash reflects the actual toggle request.
    vec2 speaker=p-vec2(1490,179);
    col=mix(col,vec3(.70,.95,1),line(length(speaker)-65.0,1.2)*.60);
    const vec2 outline[7]=vec2[7](vec2(-3,-21),vec2(-18,-9),vec2(-27,-9),vec2(-27,9),vec2(-18,9),vec2(-3,21),vec2(-3,-21));
    float speakerStroke=1000.0;
    for(int i=0;i<6;i++) speakerStroke=min(speakerStroke,stroke(speaker,outline[i],outline[i+1]));
    col=mix(col,vec3(1),fill(speakerStroke-1.8)*.95);
    if(c.library.z==0u) {
        // Separate, round-ended 90-degree arcs leave a clear gap from the speaker.
        float angle=clamp(atan(speaker.y,speaker.x),-.7853981634,.7853981634);
        vec2 direction=vec2(cos(angle),sin(angle));
        float rays=min(length(speaker-direction*16.0),length(speaker-direction*31.0));
        col=mix(col,vec3(1),fill(rays-1.8)*.95);
    } else {
        vec2 slash=vec2(speaker.x+speaker.y,speaker.y-speaker.x)*.7071;
        col=mix(col,vec3(1),fill(box(slash,vec2(0),vec2(36,2.2),2.0)));
    }
    uint count=min(c.library.x,32u);
    if(count>0u) {
        col=mix(col,vec3(.05,.12,.2),shadowText(p,vec2(302,437),TEXT_LIBRARY));
        col=mix(col,vec3(1),text(p,vec2(302,437),TEXT_LIBRARY));
        ivec4 countLabel=TEXT_APPS;
        col=mix(col,vec3(.05,.12,.2),shadowText(p,vec2(1540,443),countLabel));
        col=mix(col,vec3(1),text(p,vec2(1540,443),countLabel));
    }
    uint page=(c.state.x/3u)*3u;
    for(int i=0;i<3;i++) {
        uint index=page+uint(i);if(index>=count) continue;
        bool installed=index<c.reserved.w;
        float y=551.0+float(i)*151.0;
        float selected=c.state.x==index?1.0:0.0;
        float pulse=.6+.4*sin(t*2.4);
        float d=box(p,vec2(960,y),vec2(660,62),18.0);
        float shadow=exp(-max(box(p,vec2(960,y+7.0),vec2(660,62),18.0),0.0)/12.0);
        col=mix(col,vec3(.38,.62,.74),shadow*.08);
        col=mix(col,vec3(1),fill(d));
        col=mix(col,mix(vec3(.83,.90,.94),vec3(.06,.65,.92),selected),line(d,1.0+selected*.4));
        col=mix(col,BLUE,exp(-max(d,0.0)/8.0)*selected*.04*pulse);
        float tile=box(p,vec2(370,y),vec2(43,43),12.0);
        col=mix(col,mix(vec3(.94,.97,.985),vec3(.88,.96,1),selected),fill(tile));
        if(installed){
            vec4 icon=catalogIcon(p,vec2(370,y),index);col=mix(col,icon.rgb,icon.a);
            col=mix(col,INK,catalogText(p,vec2(450,y-30),index,false));
            col=mix(col,vec3(.39,.57,.68),catalogText(p,vec2(452,y+18),index,true));
        }else{
            float plus=min(box(p,vec2(370,y),vec2(11,1),1.0),box(p,vec2(370,y),vec2(1,11),1.0));
            col=mix(col,vec3(.54,.75,.85),fill(plus)*.7);
            col=mix(col,vec3(.88,.93,.96),fill(box(p,vec2(574,y-12.0),vec2(124,5),5))*.7);
            col=mix(col,vec3(.92,.95,.97),fill(box(p,vec2(530,y+13),vec2(80,3),3)));
        }
        // Three tiny dots give the otherwise blank rows a gentle end cap.
        for(int j=0;j<3;j++) col=mix(col,vec3(.63,.76,.82),fill(length(p-vec2(1540+float(j)*9.0,y))-1.5)*.7);
        float marker=box(p,vec2(289,y),vec2(2,18),2.0);
        col=mix(col,BLUE,fill(marker)*selected);
    }
    if(count==0u) {
        // Empty library: a quiet SD-card/search icon, with no placeholder rows.
        vec2 center=vec2(960,625);
        col=mix(col,vec3(.90,.96,.985),fill(length(p-center)-86.0));
        vec2 card=p-(center-vec2(7,5));
        float body=max(box(card,vec2(0),vec2(39,49),6.0),(card.x-card.y-66.0)*.7071);
        col=mix(col,vec3(1),fill(body));
        col=mix(col,vec3(.23,.60,.79),line(body,1.8));
        for(int i=0;i<4;i++) col=mix(col,vec3(.48,.75,.87),fill(box(card,vec2(-20+float(i)*11.0,-29),vec2(2.5,8),1.5)));
        col=mix(col,vec3(.70,.86,.93),line(box(card,vec2(0,17),vec2(21,12),3.0),1.0));
        vec2 lens=p-(center+vec2(30,31));
        col=mix(col,vec3(1),fill(length(lens)-20.0));
        col=mix(col,BLUE,line(length(lens)-16.0,2.0));
        vec2 handle=lens-vec2(19,19);
        vec2 diagonal=vec2(handle.x+handle.y,handle.y-handle.x)*.7071;
        col=mix(col,BLUE,fill(box(diagonal,vec2(0),vec2(10,2),2.0)));
        col=mix(col,INK,text(p,vec2(960.0-float(TEXT_NOTITLES.z)*.5,751),TEXT_NOTITLES));
        col=mix(col,vec3(.42,.58,.66),text(p,vec2(960.0-float(TEXT_EMPTYHINT.z)*.5,805),TEXT_EMPTYHINT));
    } else {
        col=mix(col,BLUE,line(length(p-vec2(1480,1017))-14.0,1.2));
        col=mix(col,BLUE,text(p,vec2(1474,1011),TEXT_BUTTON_A));
        col=mix(col,INK,text(p,vec2(1505,1009),TEXT_SELECT));
    }
    col=mix(col,BLUE,line(length(p-vec2(1638,1017))-14.0,1.2));
    col=mix(col,BLUE,text(p,vec2(1633,1011),TEXT_BUTTON_B));
    col=mix(col,INK,text(p,vec2(1663,1009),TEXT_BACK));
    // A opens a friendly empty-slot panel; B brings the waves back into focus.
    float modal=c.motion.z;
    if(modal>.001) {
        col=mix(col,vec3(.06,.23,.37),modal*.30);
        float d=box(p,vec2(960,540),vec2(390,154),24.0);
        col=mix(col,vec3(1),fill(d)*modal);
        col=mix(col,vec3(.75,.90,.96),line(d,1.0)*modal);
        col=mix(col,INK,text(p,vec2(795,461),TEXT_EMPTY)*modal);
        col=mix(col,vec3(.37,.53,.63),text(p,vec2(769,527),TEXT_DETAIL)*modal);
        col=mix(col,BLUE,text(p,vec2(878,611),TEXT_CLOSE)*modal);
    }
    if(hbHas(HB_JOY_MOUSE)&&c.game.x!=0u&&c.stats.w!=0u){
        vec2 q=p-c.flow.xy;
        float cursor=min(stroke(q,vec2(0),vec2(0,28)),min(stroke(q,vec2(0),vec2(22,20)),stroke(q,vec2(0,28),vec2(22,20))));
        col=mix(col,vec3(1),fill(cursor-3.8));col=mix(col,INK,fill(cursor-1.7));
    }
    col=mix(col,vec3(.05,.12,.2),shadowText(p,vec2(36,1024),TEXT_CREDIT));
    col=mix(col,vec3(.78,.88,.94),text(p,vec2(36,1024),TEXT_CREDIT));
    outColor=vec4(col*(1.0-c.transition.x),1);
}
