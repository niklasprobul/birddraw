
let jsr = 0x5EED;
let {PI} = Math;
function rand(){
  jsr^=(jsr<<17);
  jsr^=(jsr>>13);
  jsr^=(jsr<<5);
  return (jsr>>>0)/4294967295;
}

var PERLIN_YWRAPB = 4; var PERLIN_YWRAP = 1<<PERLIN_YWRAPB;
var PERLIN_ZWRAPB = 8; var PERLIN_ZWRAP = 1<<PERLIN_ZWRAPB;
var PERLIN_SIZE = 4095;
var perlin_octaves = 4;var perlin_amp_falloff = 0.5;
var scaled_cosine = function(i) {return 0.5*(1.0-Math.cos(i*PI));};
var perlin;
let noise = function(x,y,z) {
  y = y || 0; z = z || 0;
  if (perlin == null) {
    perlin = new Array(PERLIN_SIZE + 1);
    for (var i = 0; i < PERLIN_SIZE + 1; i++) {
      perlin[i] = rand();
    }
  }
  if (x<0) { x=-x; } if (y<0) { y=-y; } if (z<0) { z=-z; }
  var xi=Math.floor(x), yi=Math.floor(y), zi=Math.floor(z);
  var xf = x - xi; var yf = y - yi; var zf = z - zi;
  var rxf, ryf;
  var r=0; var ampl=0.5;
  var n1,n2,n3;
  for (var o=0; o<perlin_octaves; o++) {
    var of=xi+(yi<<PERLIN_YWRAPB)+(zi<<PERLIN_ZWRAPB);
    rxf = scaled_cosine(xf); ryf = scaled_cosine(yf);
    n1  = perlin[of&PERLIN_SIZE];
    n1 += rxf*(perlin[(of+1)&PERLIN_SIZE]-n1);
    n2  = perlin[(of+PERLIN_YWRAP)&PERLIN_SIZE];
    n2 += rxf*(perlin[(of+PERLIN_YWRAP+1)&PERLIN_SIZE]-n2);
    n1 += ryf*(n2-n1);
    of += PERLIN_ZWRAP;
    n2  = perlin[of&PERLIN_SIZE];
    n2 += rxf*(perlin[(of+1)&PERLIN_SIZE]-n2);
    n3  = perlin[(of+PERLIN_YWRAP)&PERLIN_SIZE];
    n3 += rxf*(perlin[(of+PERLIN_YWRAP+1)&PERLIN_SIZE]-n3);
    n2 += ryf*(n3-n2);
    n1 += scaled_cosine(zf)*(n2-n1);
    r += n1*ampl;
    ampl *= perlin_amp_falloff;
    xi<<=1; xf*=2; yi<<=1; yf*=2; zi<<=1; zf*=2;
    if (xf>=1.0) { xi++; xf--; }
    if (yf>=1.0) { yi++; yf--; }
    if (zf>=1.0) { zi++; zf--; }
  }
  return r;
};

function dist(x0,y0,x1,y1){
  return Math.hypot(x1-x0,y1-y0);
}
function lerp(a,b,t){
  return a * (1-t) + b * t;
}
function lerp2d(x0,y0,x1,y1,t){
  return [
    x0*(1-t) + x1*t,
    y0*(1-t) + y1*t,
  ]
}
function get_bbox(points){
  let xmin = Infinity;
  let ymin = Infinity;
  let xmax = -Infinity;
  let ymax = -Infinity
  for (let i = 0;i < points.length; i++){
    let [x,y] = points[i];
    xmin = Math.min(xmin,x);
    ymin = Math.min(ymin,y);
    xmax = Math.max(xmax,x);
    ymax = Math.max(ymax,y);
  }
  return {x:xmin,y:ymin,w:xmax-xmin,h:ymax-ymin};
}

function seg_isect(p0x, p0y, p1x, p1y, q0x, q0y, q1x, q1y, is_ray = false) {
  let d0x = p1x - p0x;
  let d0y = p1y - p0y;
  let d1x = q1x - q0x;
  let d1y = q1y - q0y;
  let vc = d0x * d1y - d0y * d1x;
  if (vc == 0) {
    return null;
  }
  let vcn = vc * vc;
  let q0x_p0x = q0x - p0x;
  let q0y_p0y = q0y - p0y;
  let vc_vcn = vc / vcn;
  let t = (q0x_p0x * d1y - q0y_p0y * d1x) * vc_vcn;
  let s = (q0x_p0x * d0y - q0y_p0y * d0x) * vc_vcn;
  if (0 <= t && (is_ray || t < 1) && 0 <= s && s < 1) {
    let ret = {t, s, side: null, other: null, xy: null};
    ret.xy = [p1x * t + p0x * (1 - t), p1y * t + p0y * (1 - t)];
    ret.side = pt_in_pl(p0x, p0y, p1x, p1y, q0x, q0y) < 0 ? 1 : -1;
    return ret;
  }
  return null;
}
function pt_in_pl(x, y, x0, y0, x1, y1) {
  let dx = x1 - x0;
  let dy = y1 - y0;
  let e = (x - x0) * dy - (y - y0) * dx;
  return e;
}

function poly_bridge(poly0,poly1){
  let dmin = Infinity;
  let imin = null;
  for (let i = 0; i < poly0.length; i++){
    for (let j = 0; j < poly1.length; j++){
      let [x0,y0] = poly0[i];
      let [x1,y1] = poly1[j];
      let dx = x0-x1;
      let dy = y0-y1;
      let d2 = dx*dx + dy*dy;
      if (d2 < dmin){
        dmin = d2;
        imin = [i,j];
      }
    }
  }
  let u = poly0.slice(0,imin[0]).concat(
    poly1.slice(imin[1])).concat(
      poly1.slice(0,imin[1])).concat(
        poly0.slice(imin[0]));
  return u;
}

function poly_union(poly0,poly1,self_isect=false){
  let verts0 = poly0.map(xy=>({xy, isects: [], isects_map: {}}));
  let verts1 = poly1.map(xy=>({xy, isects: [], isects_map: {}}));

  function pair_key() {
    return Array.from(arguments).join(',');
  }

  let has_isect = false;

  function build_vertices(poly,other,out,oout,idx){
    let n = poly.length;
    let m = other.length;
    if (self_isect){
      for (let i = 0; i < n; i++) {
        let id = pair_key(idx,i);
        let p = out[i];
        let i1 = (i + 1 + n) % n;
        let a = poly[i];
        let b = poly[i1];
        for (let j = 0; j < n; j++) {
          let jd = pair_key(idx,j);
          let j1 = (j + 1 + n) % n;
          if (i == j || i == j1 || i1 == j || i1 == j1) {
            continue;
          }
          let c = poly[j];
          let d = poly[j1];
          let xx;
          let ox = out[j].isects_map[id];
          if (ox) {
            xx = {
              t: ox.s,
              s: ox.t,
              xy: ox.xy,
              other: null,
              side: pt_in_pl(...a, ...b, ...c) < 0 ? 1 : -1
            };
          }else{
            xx = seg_isect(...a, ...b, ...c, ...d);
          }
          if (xx) {
            xx.other = j;
            xx.jump = false;
            p.isects.push(xx);
            p.isects_map[jd] = xx;
          }
        }
        
      }
    }

    for (let i = 0; i < n; i++) {
      let id = pair_key(idx,i);
      let p = out[i];
      let i1 = (i + 1 + n) % n;
      let a = poly[i];
      let b = poly[i1];
      for (let j = 0; j < m; j++) {
        let jd = pair_key(1-idx,j);
        let j1 = (j + 1 + m) % m;
        let c = other[j];
        let d = other[j1];
        let xx;

        let ox = oout[j].isects_map[id];
        if (ox) {
          xx = {
            t: ox.s,
            s: ox.t,
            xy: ox.xy,
            other: null,
            side: pt_in_pl(...a, ...b, ...c) < 0 ? 1 : -1
          };
        } else {
          xx = seg_isect(...a, ...b, ...c, ...d);
        }
        if (xx) {
          has_isect = true;
          xx.other = j;
          xx.jump = true;
          p.isects.push(xx);
          p.isects_map[jd] = xx;
        }
      }
      p.isects.sort((a2, b2) => a2.t - b2.t);
    }
  }
  build_vertices(poly0,poly1,verts0,verts1,0);
  build_vertices(poly1,poly0,verts1,verts0,1);
  
  if (!has_isect){
    if (!self_isect){
      return poly_bridge(poly0,poly1);
    }else{
      return poly_union(poly_bridge(poly0,poly1),[],true);
    }
  }


  let isect_mir = {};
  function mirror_isects(verts0,verts1,idx) {
    let n = verts0.length;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < verts0[i].isects.length; j++) {
        let id = pair_key(idx, i, j);
        let {jump} = verts0[i].isects[j];
        let jd = jump?(1-idx):idx;
        let k = verts0[i].isects[j].other;
        let z = (jump?verts1:verts0)[k].isects.findIndex((x) => (x.jump == jump && x.other == i));
        isect_mir[id] = [jd, k, z];
      }
    }
  }
  mirror_isects(verts0,verts1,0);
  mirror_isects(verts1,verts0,1);

  // console.log(verts0,verts1)

  function trace_outline(idx, i0, j0, dir) {
    let zero = null;
    let out = [];
    function trace_from(idx, i0, j0, dir) {
      if (zero == null) {
        zero = [idx, i0, j0];
      } else if (idx == zero[0] && i0 == zero[1] && j0 == zero[2]) {
        return true;
      }
      let verts = idx?verts1:verts0;
      let n = verts.length;
      let p = verts[i0];
      let i1 = (i0 + dir + n) % n;
      if (j0 == -1) {
        out.push(p.xy);
        if (dir < 0) {
          return trace_from(idx,i1, verts[i1].isects.length - 1, dir);
        } else if (!verts[i0].isects.length) {
          return trace_from(idx, i1, -1, dir, [i0, j0]);
        } else {
          return trace_from(idx, i0, 0, dir, [i0, j0]);
        }
      } else if (j0 >= p.isects.length) {
        return trace_from(idx, i1, -1, dir, [i0, j0]);
      } else {
        let id = pair_key(idx, i0, j0);
        out.push(p.isects[j0].xy);

        let q = p.isects[j0];
        let [jdx, k, z] = isect_mir[id];
        let params;
        if (q.side * dir < 0) {
          params = [jdx, k, z - 1, -1];
        } else {
          params = [jdx, k, z + 1, 1];
        }
        return trace_from(...params);
      }
    }
    let success = trace_from(idx, i0, j0, dir);
    if (!success || out.length < 3) {
      return null;
    }
    return out;
  }

  let xmin = Infinity;
  let amin = null;
  for (let i = 0; i < poly0.length; i++) {
    if (poly0[i][0] < xmin) {
      xmin = poly0[i][0];
      amin = [0,i];
    }
  }
  for (let i = 0; i < poly1.length; i++) {
    if (poly1[i][0] < xmin) {
      xmin = poly1[i][0];
      amin = [1,i];
    }
  }

  function check_concavity(poly, idx) {
    let n = poly.length;
    let a = poly[(idx - 1 + n) % n];
    let b = poly[idx];
    let c = poly[(idx + 1) % n];
    let cw = pt_in_pl(...a, ...b, ...c) < 0 ? 1 : -1;
    return cw;
  }

  let cw = check_concavity(amin[0]?poly1:poly0, amin[1]);
  let ret = trace_outline(...amin, -1, cw, true);
  if (!ret) {
    return [];
  }
  return ret;
}

function seg_isect_poly(x0,y0,x1,y1,poly,is_ray=false){
  let n = poly.length;
  let isects = [];
  for (let i = 0; i < poly.length; i++){
    let a = poly[i];
    let b = poly[(i+1)%n];
    let xx = seg_isect(x0,y0,x1,y1,...a,...b,is_ray);
    if (xx){
      isects.push(xx);
    }
  }
  isects.sort((a,b)=>a.t-b.t);
  return isects;
}


function clip(polyline,polygon){
  if (!polyline.length){
    return {true:[],false:[]};
  }
  let zero = seg_isect_poly(...polyline[0],polyline[0][0]+Math.E,polyline[0][1]+PI,polygon,true).length % 2 != 0;
  let out = {
    'true' :[[]],
    'false':[[]],
  }
  let io = zero;
  for (let i = 0; i < polyline.length; i++){
    let a= polyline[i];
    let b= polyline[i+1];
    out[io][out[io].length-1].push(a);
    if (!b) break;

    let isects = seg_isect_poly(...a,...b,polygon,false);
    for (let j = 0; j < isects.length; j++){
      out[io][out[io].length-1].push(isects[j].xy);
      io = !io;
      out[io].push([isects[j].xy]);
    }
  }
  out.true = out.true.filter(x=>x.length);
  out.false = out.false.filter(x=>x.length);
  return out;
}

function clip_multi(polylines,polygon,clipper_func=clip){
  let out = {
    true:[],
    false:[],
  };
  for (let i = 0; i < polylines.length; i++){
    let c = clipper_func(polylines[i],polygon);
    out.true.push(...c.true);
    out.false.push(...c.false); 
  }
  return out;
}

function binclip(polyline,func){
  if (!polyline.length){
    return {true:[],false:[]};
  }
  let bins = [];
  for (let i = 0; i < polyline.length; i++){
    let t = i/(polyline.length-1);
    bins.push(func(...polyline[i],t));
  }
  let zero = bins[0];
  let out = {
    'true' :[[]],
    'false':[[]],
  }
  let io = zero;
  for (let i = 0; i < polyline.length; i++){
    let a= polyline[i];
    let b= polyline[i+1];
    out[io][out[io].length-1].push(a);
    if (!b) break;

    let do_isect = bins[i] != bins[i+1];

    if (do_isect){
      let pt = lerp2d(...a,...b,0.5);
      out[io][out[io].length-1].push(pt);
      io = !io;
      out[io].push([pt]);
    }
  }
  out.true = out.true.filter(x=>x.length);
  out.false = out.false.filter(x=>x.length);
  return out;
}


function shade_shape(poly,step=5,dx=10,dy=20){
  let bbox = get_bbox(poly);
  bbox.x -= step;
  bbox.y -= step;
  bbox.w += step*2;
  bbox.h += step*2;
  let lines = [];
  for (let i = -bbox.h; i < bbox.w; i+=step){
    let x0 = bbox.x + i;
    let y0 = bbox.y;
    let x1 = bbox.x + i + bbox.h;
    let y1 = bbox.y + bbox.h;
    lines.push([[x0,y0],[x1,y1]]);
  }
  lines = clip_multi(lines,poly).true;

  let carve = trsl_poly(poly,-dx,-dy);

  lines = clip_multi(lines,carve).false;

  for (let i = 0; i < lines.length; i++){
    let [a,b] = lines[i];
    let s = rand()*0.5;
    if (dy > 0){
      a = lerp2d(...a,...b,s);
      lines[i][0] = a;
    }else{
      b = lerp2d(...b,...a,s);
      lines[i][1] = b;
    }
  }

  return lines;
}


function fill_shape(poly,step=5){
  let bbox = get_bbox(poly);
  bbox.x -= step;
  bbox.y -= step;
  bbox.w += step*2;
  bbox.h += step*2;
  let lines = [];
  for (let i = 0; i < bbox.w+bbox.h/2; i+=step){
    let x0 = bbox.x + i;
    let y0 = bbox.y;
    let x1 = bbox.x + i - bbox.h/2;
    let y1 = bbox.y + bbox.h;
    lines.push([[x0,y0],[x1,y1]]);
  }
  lines = clip_multi(lines,poly).true;
  return lines;
}

function patternshade_shape(poly,step=5,pattern_func){
  let bbox = get_bbox(poly);
  bbox.x -= step;
  bbox.y -= step;
  bbox.w += step*2;
  bbox.h += step*2;
  let lines = [];
  for (let i = -bbox.h/2; i < bbox.w; i+=step){
    let x0 = bbox.x + i;
    let y0 = bbox.y;
    let x1 = bbox.x + i + bbox.h/2;
    let y1 = bbox.y + bbox.h;
    lines.push([[x0,y0],[x1,y1]]);
  }
  lines = clip_multi(lines,poly).true;

  for (let i = 0; i < lines.length; i++){
    lines[i] = resample(lines[i],2);
  }

  lines = clip_multi(lines,pattern_func,binclip).true;

  return lines;
}


function vein_shape(poly,n=50){
  let bbox = get_bbox(poly);
  let out = [];
  for (let i = 0; i < n; i++){
    let x = bbox.x + rand()*bbox.w;
    let y = bbox.y + rand()*bbox.h;
    let o = [[x,y]];
    for (let j = 0; j < 15; j++){
      let dx = (noise(x*0.1,y*0.1,7)-0.5)*4;
      let dy = (noise(x*0.1,y*0.1,6)-0.5)*4;
      x += dx;
      y += dy;
      o.push([x,y]);
    }
    out.push(o);
  }
  out = clip_multi(out,poly).true;
  return out;
}

function isect_circ_line(cx,cy,r,x0,y0,x1,y1){
  //https://stackoverflow.com/a/1084899
  let dx = x1-x0;
  let dy = y1-y0;
  let fx = x0-cx;
  let fy = y0-cy;
  let a = dx*dx+dy*dy;
  let b = 2*(fx*dx+fy*dy);
  let c = (fx*fx+fy*fy)-r*r;
  let discriminant = b*b-4*a*c;
  if (discriminant<0){
    return null;
  }
  discriminant = Math.sqrt(discriminant);
  let t0 = (-b - discriminant)/(2*a);
  if (0 <= t0 && t0 <= 1){
    return t0;
  }
  let t = (-b + discriminant)/(2*a);
  if (t > 1 || t < 0){
    return null;
  }
  return t;
}

function resample(polyline,step){
  if (polyline.length < 2){
    return polyline.slice();
  }
  polyline = polyline.slice();
  let out = [polyline[0].slice()];
  let next = null;
  let i = 0;
  while(i < polyline.length-1){
    let a = polyline[i];
    let b = polyline[i+1];
    let dx = b[0]-a[0];
    let dy = b[1]-a[1];
    let d = Math.sqrt(dx*dx+dy*dy);
    if (d == 0){
      i++;
      continue;
    }
    let n = ~~(d/step);
    let rest = (n*step)/d;
    let rpx = a[0] * (1-rest) + b[0] * rest;
    let rpy = a[1] * (1-rest) + b[1] * rest;
    for (let j = 1; j <= n; j++){
      let t = j/n;
      let x = a[0]*(1-t) + rpx*t;
      let y = a[1]*(1-t) + rpy*t;
      let xy = [x,y];
      for (let k = 2; k < a.length; k++){
        xy.push(a[k]*(1-t) + (a[k] * (1-rest) + b[k] * rest)*t);
      }
      out.push(xy);
    }

    next = null;
    for (let j = i+2; j < polyline.length; j++){
      let b = polyline[j-1];
      let c = polyline[j];
      if (b[0] == c[0] && b[1] == c[1]){
        continue;
      }
      let t = isect_circ_line(rpx,rpy,step,b[0],b[1],c[0],c[1]);
      if (t == null){
        continue;
      }
 
      let q = [
        b[0]*(1-t)+c[0]*t,
        b[1]*(1-t)+c[1]*t,
      ];
      for (let k = 2; k < b.length; k++){
        q.push(b[k]*(1-t)+c[k]*t);
      }
      out.push(q);
      polyline[j-1] = q;
      next = j-1;
      break;
    }
    if (next == null){
      break;
    }
    i = next;

  }

  if (out.length > 1){
    let lx = out[out.length-1][0];
    let ly = out[out.length-1][1];
    let mx = polyline[polyline.length-1][0];
    let my = polyline[polyline.length-1][1];
    let d = Math.sqrt((mx-lx)**2+(my-ly)**2);
    if (d < step*0.5){
      out.pop(); 
    }
  }
  out.push(polyline[polyline.length-1].slice());
  return out;
}


function pt_seg_dist(p, p0, p1)  {
  // https://stackoverflow.com/a/6853926
  let x = p[0];   let y = p[1];
  let x1 = p0[0]; let y1 = p0[1];
  let x2 = p1[0]; let y2 = p1[1];
  let A = x - x1; let B = y - y1; let C = x2 - x1; let D = y2 - y1;
  let dot = A*C+B*D;
  let len_sq = C*C+D*D;
  let param = -1;
  if (len_sq != 0) {
    param = dot / len_sq;
  }
  let xx; let yy;
  if (param < 0) {
    xx = x1; yy = y1;
  }else if (param > 1) {
    xx = x2; yy = y2;
  }else {
    xx = x1 + param*C;
    yy = y1 + param*D;
  }
  let dx = x - xx;
  let dy = y - yy;
  return Math.sqrt(dx*dx+dy*dy);
}

function approx_poly_dp(polyline, epsilon){
  if (polyline.length <= 2){
    return polyline;
  }
  let dmax   = 0;
  let argmax = -1;
  for (let i = 1; i < polyline.length-1; i++){
    let d = pt_seg_dist(polyline[i] , 
                        polyline[0] , 
                        polyline[polyline.length-1] );
    if (d > dmax){
      dmax = d;
      argmax = i;
    }  
  }
  let ret = [];
  if (dmax > epsilon){
    let L = approx_poly_dp(polyline.slice(0,argmax+1),epsilon);
    let R = approx_poly_dp(polyline.slice(argmax,polyline.length),epsilon);
    ret = ret.concat(L.slice(0,L.length-1)).concat(R);
  }else{
    ret.push(polyline[0].slice());
    ret.push(polyline[polyline.length-1].slice());
  }
  return ret;
}

function distsq(x0, y0, x1, y1) {
  let dx = x0-x1;
  let dy = y0-y1;
  return dx*dx+dy*dy;
}
function poissondisk(W, H, r, samples) {
  let grid = [];
  let active = [];
  let w =  ((r) / (1.4142135624));
  let r2 = ((r) * (r));
  let cols = (~~(((W) / (w))));
  let rows = (~~(((H) / (w))));
  for (let i = (0); Number((i) < (((cols) * (rows)))); i += (1)) {
    (grid).splice((grid.length), 0, (-1));
  };
  let pos = [(((W) / (2.0))), (((H) / (2.0)))];
  (samples).splice((samples.length), 0, (pos));
  for (let i = (0); Number((i) < (samples.length)); i += (1)) {
    let col = (~~(((((((samples)[i]))[0])) / (w))));
    let row = (~~(((((((samples)[i]))[1])) / (w))));
    ((grid)[((col) + (((row) * (cols))))] = i);
    (active).splice((active.length), 0, (((samples)[i])));
  };
  while (active.length) {
    let ridx = (~~(((rand()) * (active.length))));
    pos = ((active)[ridx]);
    let found = 0;
    for (let n = (0); Number((n) < (30)); n += (1)) {
      let sr = ((r) + (((rand()) * (r))));
      let sa = ((6.2831853072) * (rand()));
      let sx = ((((pos)[0])) + (((sr) * (Math.cos(sa)))));
      let sy = ((((pos)[1])) + (((sr) * (Math.sin(sa)))));
      let col = (~~(((sx) / (w))));
      let row = (~~(((sy) / (w))));
      if (((((((((Number((col) > (0))) && (Number((row) > (0))))) && (Number((col) < (((cols) - (1))))))) && (Number((row) < (((rows) - (1))))))) && (Number((((grid)[((col) + (((row) * (cols))))])) == (-1))))) {
        let ok = 1;
        for (let i = (-1); Number((i) <= (1)); i += (1)) {
          for (let j = (-1); Number((j) <= (1)); j += (1)) {
            let idx = ((((((((row) + (i))) * (cols))) + (col))) + (j));
            let nbr = ((grid)[idx]);
            if (Number((-1) != (nbr))) {
              let d = distsq(sx, sy, ((((samples)[nbr]))[0]), ((((samples)[nbr]))[1]));
              if (Number((d) < (r2))) {
                ok = 0;
              };
            };
          };
        };
        if (ok) {
          found = 1;
          ((grid)[((((row) * (cols))) + (col))] = samples.length);
          let sample = [(sx), (sy)];
          (active).splice((active.length), 0, (sample));
          (samples).splice((samples.length), 0, (sample));
        };
      };
    };
    if (Number(!(found))) {
      (active).splice((ridx), (1));
    };
  };
}


function draw_svg(polylines){
  let o = `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="320">`
  o += `<rect x="0" y="0" width="520" height="320" fill="floralwhite"/><rect x="10" y="10" width="500" height="300" stroke="black" stroke-width="1" fill="none"/><path stroke="black" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round" d="`
  for (let i = 0; i < polylines.length; i++){
    o += '\nM ';
    for (let j = 0; j < polylines[i].length; j++){
      let [x,y] = polylines[i][j];
      o += `${(~~((x+10)*100)) /100} ${(~~((y+10)*100)) /100} `;
    }
  }
  o += `\n"/></svg>`
  return o;
}

function draw_svg_anim(polylines,speed){
  let o = `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="320">`;
  o += `<rect x="0" y="0" width="520" height="320" fill="floralwhite"/><rect x="10" y="10" width="500" height="300" stroke="black" stroke-width="1" fill="none"/>`
  let lengths = [];
  let acc_lengths = [];
  let total_l = 0;
  for (let i = 0; i < polylines.length; i++){
    let l = 0;
    for (let j = 1; j < polylines[i].length; j++){
      l += Math.hypot(
        polylines[i][j-1][0]-polylines[i][j][0],
        polylines[i][j-1][1]-polylines[i][j][1]
      );
    }
    lengths.push(l);
    acc_lengths.push(total_l);
    total_l+=l;
  }
  for (let i = 0; i < polylines.length; i++){
    let l = lengths[i];
    o += `
    <path 
      stroke="black" 
      stroke-width="1" 
      fill="none" 
      stroke-dasharray="${l}"
      stroke-dashoffset="${l}"
      d="M`;
    for (let j = 0; j < polylines[i].length; j++){
      o += polylines[i][j] + ' ';
    }
    let t = speed*l;
    o += `">
    <animate id="a${i}"
      attributeName="stroke-dashoffset" 
      fill="freeze"
      from="${l}" to="${0}" dur="${t}s" 
      begin="${(acc_lengths[i])*speed}s;a${i}.end+${8+speed*total_l-t}s"/>
    />
    <animate id="b${i}"
      attributeName="stroke-dashoffset" 
      fill="freeze"
      from="${0}" to="${l}" dur="${3}s" 
      begin="${5+speed*total_l}s;b${i}.end+${5+speed*total_l}s"/>
    />
    </path>`;
  }
  o += `</svg>`;
  return o;
}

function draw_ps(polylines){
  let o = `%!PS-Adobe-3.0 EPSF-3.0
%%BoundingBox: 0 0 520 320
1 setlinewidth
0.5 0.5 translate
/m /moveto load def
/l /lineto load def
/F /stroke load def
%%EndPageSetup
10 10 m
510 10 l
510 310 l
10 310 l
closepath
F
`;
  for (let i = 0; i < polylines.length; i++){
    for (let j = 0; j < polylines[i].length; j++){
      let [x,y] = polylines[i][j];
      o += `${(~~((x+10)*100)) /100} ${(~~((310-y)*100)) /100} `;
      if (j == 0) {
        o += `m\n`;
      } else {
        o += `l\n`;
      }
    }
    o += `F\n\n`;
  }
  return o;
}




function pow(a,b){
  return Math.sign(a) * Math.pow(Math.abs(a),b);
}

function gauss2d(x, y){
  let z0 = Math.exp(-0.5*x*x);
  let z1 = Math.exp(-0.5*y*y);
  return z0*z1;
 }

function squama_mask(w,h){
  let p = [];
  let n = 7;
  for (let i = 0; i < n; i++){
    let t = i/n;
    let a = t * PI * 2;
    let x = -pow(Math.cos(a),1.3)*w;
    let y =  pow(Math.sin(a),1.3)*h;
    p.push([x,y]);
  }
  return p;
}

function squama(w,h,m=3) {
  let p = [];
  let n = 8;
  for (let i = 0; i < n; i++){
    let t = i/(n-1);
    let a = t * PI + PI/2;
    let x = -pow(Math.cos(a),1.4)*w;
    let y =  pow(Math.sin(a),1.4)*h;
    p.push([x,y]);
  }
  let q = [p];
  for (let i = 0; i < m; i++){
    let t = i/(m-1);
    q.push([
      [-w*0.3 + (rand()-0.5),-h*0.2+t*h*0.4 + (rand()-0.5)],
      [ w*0.5 + (rand()-0.5),-h*0.3+t*h*0.6 + (rand()-0.5)]
    ]);
  }
  return q;
}

function trsl_poly(poly,x,y){
  return poly.map(xy=>[xy[0]+x,xy[1]+y]);
}
function scl_poly(poly,sx,sy){
  if (sy === undefined) sy = sx;
  return poly.map(xy=>[xy[0]*sx,xy[1]*sy]);
}
function shr_poly(poly,sx){
  return poly.map(xy=>[xy[0]+xy[1]*sx,xy[1]]);
}
function rot_poly(poly,th){
  let qoly = [];
  let costh = Math.cos(th);
  let sinth = Math.sin(th);
  for (let i = 0; i < poly.length; i++){
    let [x0,y0] = poly[i]
    let x = x0* costh-y0*sinth;
    let y = x0* sinth+y0*costh;
    qoly.push([x,y]);
  }
  return qoly;
}

function squama_mesh(m,n,uw,uh,squama_func,noise_x,noise_y,interclip=true){
  let clipper = null;

  let pts = [];
  for (let i = 0; i < n; i++){
    for (let j = 0; j < m; j++){
      let x = j*uw;
      let y = (n*uh/2) - Math.cos(i/(n-1) * PI) * (n*uh/2);
      let a = noise(x*0.005,y*0.005)*PI*2-PI;
      let r = noise(x*0.005,y*0.005);
      let dx = Math.cos(a)*r*noise_x;
      let dy = Math.cos(a)*r*noise_y;
      pts.push([x+dx,y+dy]);
    }
  }
  let out = [];

  let whs = [];
  for (let i = 0; i < n; i++){
    for (let j = 0; j < m; j++){
      if (i == 0 || j == 0 || i == n-1 || j == m-1){
        whs.push([uw/2,uh/2]);
        continue;
      }
      let a = pts[i*m+j];
      let b = pts[i*m+j+1];
      let c = pts[i*m+j-1];
      let d = pts[(i-1)*m+j];
      let e = pts[(i+1)*m+j];

      let dw = (dist(...a,...b) + dist(...a,...c))/4
      let dh = (dist(...a,...d) + dist(...a,...e))/4
      whs.push([dw,dh]);
    }
  }

  for (let j = 1; j < m-1; j++){
    for (let i = 1; i < n-1; i++){
      let [x,y]  = pts[i*m+j];
      let [dw,dh]= whs[i*m+j];
      let q = trsl_poly(squama_mask(dw,dh),x,y);

      let p = squama_func(x,y,dw,dh).map(a=>trsl_poly(a,x,y));
      if (!interclip){
        out.push(...p);
      }else{
        if (clipper){
          out.push(...clip_multi(p,clipper).false);
          clipper = poly_union(clipper,q);
        }else{
          out.push(...p);
          clipper = q;
        }
      }
    }
    for (let i = 1; i < n-1; i++){
      let a = pts[i*m+j];
      let b = pts[i*m+j+1];
      let c = pts[(i+1)*m+j];
      let d = pts[(i+1)*m+j+1];

      let [dwa,dha] = whs[i*m+j];
      let [dwb,dhb] = whs[i*m+j+1];
      let [dwc,dhc] = whs[(i+1)*m+j];
      let [dwd,dhd] = whs[(i+1)*m+j+1];

      let [x,y] = [(a[0]+b[0]+c[0]+d[0])/4,(a[1]+b[1]+c[1]+d[1])/4];
      let [dw,dh] = [(dwa+dwb+dwc+dwd)/4,(dha+dhb+dhc+dhd)/4];
      dw *= 1.2;
      let q = trsl_poly(squama_mask(dw,dh),x,y);

      let p = squama_func(x,y,dw,dh).map(a=>trsl_poly(a,x,y));
      if (!interclip){
        out.push(...p);
      }else{
        if (clipper){
          out.push(...clip_multi(p,clipper).false);
          clipper = poly_union(clipper,q);
        }else{
          out.push(...p);
          clipper = q;
        }
      }
    }
  }
  // for (let i = 0; i < n-1; i++){
  //   for (let j = 0; j < m-1; j++){
  //     let a= pts[i*m+j];
  //     let b= pts[i*m+j+1];
  //     let c = pts[(i+1)*m+j];
  //     out.push([a,b]);
  //     out.push([a,c]);
  //   }
  // }
  return out;
}

// a bird's eye: a dark iris (or a pale iris round a dark pupil), a highlight and lid lines
function bird_eye(ex,ey,rad,type){
  let hx = ex-rad*0.35;
  let hy = ey-rad*0.35;
  let hl = ellipse(hx,hy,rad*0.28,rad*0.28,0,12);
  let pr = type ? rad*0.5 : rad*0.92;
  let fill = [];
  for (let r = pr; r > 0.3; r -= 0.55){
    fill.push(ellipse(ex,ey,r,r,rand()*PI,Math.max(8,~~(r*4))));
  }
  fill = clip_multi(fill,hl).false;
  let lines = [ellipse(ex,ey,rad,rad,rand()*PI,24),...fill];
  if (type){
    let ir = [];
    for (let k = 0; k < 7; k++){
      let a = k/7*PI*2+rand()*0.5;
      ir.push([[ex+Math.cos(a)*rad*0.6,ey+Math.sin(a)*rad*0.6],[ex+Math.cos(a)*rad*0.85,ey+Math.sin(a)*rad*0.85]]);
    }
    lines.push(...clip_multi(ir,hl).false);
  }
  let lid = [];
  let low = [];
  for (let j = 0; j < 12; j++){
    let a = lerp(-PI*0.95,-PI*0.15,j/11);
    lid.push([ex+Math.cos(a)*rad*1.3,ey+Math.sin(a)*rad*1.22]);
    a = lerp(PI*0.2,PI*0.75,j/11);
    low.push([ex+Math.cos(a)*rad*1.2,ey+Math.sin(a)*rad*1.15]);
  }
  lines.push(lid,...binclip(low,()=>rand()<0.75).true);
  return [ellipse(ex,ey,rad*1.35,rad*1.35,0,20),lines];
}


function rot_around(poly,th,cx,cy){
  return trsl_poly(rot_poly(trsl_poly(poly,-cx,-cy),th),cx,cy);
}

function bbox_overlap(a,b){
  return !(a.x > b.x+b.w || a.x+a.w < b.x || a.y > b.y+b.h || a.y+a.h < b.y);
}

// remove the parts of polylines that fall inside any of the polygons
function clip_out(polylines,polys){
  for (let k = 0; k < polys.length; k++){
    let poly = polys[k];
    if (!poly || poly.length < 3){
      continue;
    }
    let pb = get_bbox(poly);
    let out = [];
    for (let i = 0; i < polylines.length; i++){
      if (polylines[i].length < 2){
        continue;
      }
      if (bbox_overlap(get_bbox(polylines[i]),pb)){
        out.push(...clip(polylines[i],poly).false);
      }else{
        out.push(polylines[i]);
      }
    }
    polylines = out;
  }
  return polylines;
}

// layers are ordered front to back; each layer is hidden behind the outlines of the layers before it
function compose(layers){
  let occ = [];
  let out = [];
  for (let i = 0; i < layers.length; i++){
    out.push(...clip_out(layers[i].lines,occ));
    occ.push(...layers[i].occ);
  }
  return out;
}

// closed Catmull-Rom spline through the points, seg samples per span
function catmull_closed(pts,seg){
  let n = pts.length;
  let o = [];
  for (let i = 0; i < n; i++){
    let p0 = pts[(i-1+n)%n];
    let p1 = pts[i];
    let p2 = pts[(i+1)%n];
    let p3 = pts[(i+2)%n];
    for (let j = 0; j < seg; j++){
      let t = j/seg;
      let t2 = t*t;
      let t3 = t2*t;
      o.push([0,1].map(k=>0.5*(2*p1[k]+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t2+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t3)));
    }
  }
  return o;
}

function bezier3(p0,p1,p2,p3,n=20){
  let o = [];
  for (let i = 0; i < n; i++){
    let t = i/(n-1);
    let s = 1-t;
    o.push([
      s*s*s*p0[0]+3*s*s*t*p1[0]+3*s*t*t*p2[0]+t*t*t*p3[0],
      s*s*s*p0[1]+3*s*s*t*p1[1]+3*s*t*t*p2[1]+t*t*t*p3[1],
    ]);
  }
  return o;
}

function ellipse(cx,cy,rx,ry,th=0,n=24){
  let o = [];
  for (let i = 0; i <= n; i++){
    let a = i/n*PI*2;
    let x = Math.cos(a)*rx;
    let y = Math.sin(a)*ry;
    o.push([
      cx + x*Math.cos(th) - y*Math.sin(th),
      cy + x*Math.sin(th) + y*Math.cos(th),
    ]);
  }
  return o;
}

function interp_y(curve,x){
  for (let i = 0; i < curve.length-1; i++){
    let [x0,y0] = curve[i];
    let [x1,y1] = curve[i+1];
    if ((x0 <= x && x <= x1) || (x1 <= x && x <= x0)){
      return x1 == x0 ? y0 : lerp(y0,y1,(x-x0)/(x1-x0));
    }
  }
  return null;
}

// two offset edges along a path, half width given by wfunc(t)
function tube(path,wfunc){
  let l = [];
  let r = [];
  for (let i = 0; i < path.length; i++){
    let a = path[Math.max(0,i-1)];
    let b = path[Math.min(path.length-1,i+1)];
    let ang = Math.atan2(b[1]-a[1],b[0]-a[0]);
    let w = wfunc(i/(path.length-1));
    l.push([path[i][0]+Math.cos(ang-PI/2)*w, path[i][1]+Math.sin(ang-PI/2)*w]);
    r.push([path[i][0]+Math.cos(ang+PI/2)*w, path[i][1]+Math.sin(ang+PI/2)*w]);
  }
  return [l,r];
}


// a single feather: shaft from (x0,y0) along ang, narrow leading vane, wide trailing vane
function feather(x0,y0,ang,len,wid,opt){
  opt = opt || {};
  let tip     = opt.tip     || 0;    // 0 rounded .. 1 pointed
  let bend    = opt.bend    || 0;
  let lead    = opt.lead    || 0.35;
  let barbs   = opt.barbs   || 0;    // hatching density on the trailing vane
  let bar_end = opt.bar_end || 1;    // hatching stops here (pale tips make wing bars)
  let edge_from = opt.edge_from || 0; // the lower edge shows only from here to the tip
  let n = Math.max(8,~~(len/2.5));
  let ca = Math.cos(ang);
  let sa = Math.sin(ang);
  let px = -sa;
  let py =  ca;
  let u0 = lerp(0.7,0.3,tip);
  let cen = [];
  let v0 = [];
  let v1 = [];
  for (let i = 0; i < n; i++){
    let u = i/(n-1);
    let b = bend*len*u*u;
    let cx = x0 + ca*len*u + px*b;
    let cy = y0 + sa*len*u + py*b;
    let w = Math.min(1,Math.sqrt(u/0.12+0.05));
    if (u > u0){
      let v = (u-u0)/(1-u0);
      w *= lerp(Math.sqrt(Math.max(0,1-v*v)),1-v,tip);
    }
    w *= wid;
    let nz = (noise(cx*0.05,cy*0.05,11)-0.5)*w*0.3+(noise(cx*0.3,cy*0.3,12)-0.5)*w*0.12;
    cen.push([cx,cy]);
    v0.push([cx - px*(w*lead+nz), cy - py*(w*lead+nz)]);
    v1.push([cx + px*(w*(1-lead)+nz), cy + py*(w*(1-lead)+nz)]);
  }
  let lines = [];
  let k = Math.max(1,~~(n*0.08));

  // splits in the trailing vane, where barbs have come apart
  let nsplit = ~~(rand()*rand()*1.6*(opt.splits === undefined ? 1 : opt.splits));
  for (let j = 0; j < nsplit; j++){
    let i = ~~(lerp(0.35,0.85,rand())*(n-1));
    let i0 = Math.max(0,i-k*2);
    v1[i] = lerp2d(...v1[i],...cen[i],0.3);
    lines.push([v1[i],lerp2d(...cen[i0],...v1[i0],0.35)]);
  }
  let poly = v0.concat(v1.slice(0,-1).reverse());

  // edges are broken, and fade out toward the hidden base
  let zs = rand()*100;
  let edge = resample(poly,1.2);
  lines.push(...binclip(edge,(x,y,t)=>{
    let fade = Math.min(1,Math.min(t,1-t)/0.15);
    if (t > 0.5 && 1-(t-0.5)*2 < edge_from+(noise(x*0.1,y*0.1,zs+1)-0.5)*0.2){
      return false;
    }
    if (opt.solid){
      return fade > 0.3;
    }
    return noise(x*0.12,y*0.12,zs)*fade > (t < 0.5 ? 0.24 : 0.12);
  }).true);

  if (opt.rachis !== false && rand() < 0.85){
    lines.push(cen.slice(~~(rand()*n*0.15),~~(n*lerp(0.6,0.9,rand()))));
  }
  if (opt.along){
    // engraved lines running along the trailing vane, from where it shows to near the tip
    let na = Math.round(1+barbs*4);
    for (let j = 0; j < na; j++){
      let f = 0.3+0.6*(j+0.5)/na;
      let i0 = ~~((edge_from*0.45+rand()*0.15)*(n-1));
      let i1 = ~~((0.92-f*0.12-rand()*0.08)*(n-1));
      let l = [];
      for (let i = i0; i <= i1; i++){
        l.push(lerp2d(...cen[i],...v1[i],f));
      }
      if (l.length > 1){
        lines.push(l);
      }
    }
    return {poly,lines};
  }
  let m = ~~(len/2.2*barbs);
  // barbs: evenly spaced parallel strokes on the trailing vane
  for (let j = 0; j < m; j++){
    let u = 0.1 + (j+0.5)/m*(bar_end*0.88-0.1);
    let i = ~~(u*(n-1));
    let i2 = Math.min(n-1,i+k);
    let a = lerp2d(...cen[i],...v1[i],0.18);
    let b = lerp2d(...cen[i2],...v1[i2],0.85+rand()*0.08);
    lines.push([a,b]);
  }
  return {poly,lines};
}

// feathers listed front to back, each one tucked behind the ones before it
function feather_stack(specs,occ){
  occ = occ || [];
  let lines = [];
  for (let i = 0; i < specs.length; i++){
    let s = Object.assign({},specs[i]);
    // no two feathers alike
    s.bend = (s.bend||0)+(rand()-0.5)*0.03;
    let f = feather(s.x,s.y,s.ang+(rand()-0.5)*0.03,s.len*(1+(rand()-0.5)*0.06),s.wid*(1+(rand()-0.5)*0.12),s);
    lines.push(...clip_out(f.lines,occ));
    occ.push(f.poly);
  }
  return {lines,occ};
}

// engraved shading: lines running along the body, dense on the dark upperparts,
// a light band along the belly edge, and the flank left white
function form_shade(curve0,curve1,step){
  let outline = curve0.concat(curve1.slice().reverse());
  let th = Math.max(...curve0.map((p,i)=>dist(...p,...curve1[i])));
  let ds = step/th;
  let o = [];
  for (let s = ds*0.6; s < 1; s += ds){
    let line = resample(curve0.map((p,i)=>lerp2d(...p,...curve1[i],s)),1.5);
    let back = 1-s/0.36;
    let belly = (s-0.8)/0.2;
    let z = rand()*100;
    o.push(...binclip(line,(x,y,t)=>{
      let end = Math.min(1,Math.min(t,1-t)/0.12);
      let d = Math.max(back,belly*0.6+t*0.3);
      return d*end+(noise(x*0.03,y*0.03,z)-0.5)*0.25 > 0.35;
    }).true);
  }
  return clip_multi(o,outline).true;
}

// engraved shading inside a contour: copies of the contour stepped inward toward c,
// each one shorter than the last
function contour_shade(contour,poly,c,sp,m,a0=0.15){
  let o = [];
  for (let k = 1; k <= m; k++){
    let line = resample(contour.map(p=>{
      let dx = c[0]-p[0];
      let dy = c[1]-p[1];
      let l = Math.hypot(dx,dy);
      return [p[0]+dx/l*k*sp,p[1]+dy/l*k*sp];
    }),1.2);
    let a = a0+k*0.07+rand()*0.08;
    let b = 0.95-k*0.03-rand()*0.08;
    o.push(...binclip(line,(x,y,t)=>(t > a && t < b)).true);
  }
  return clip_multi(o,poly).true;
}

function pt_in_poly(x,y,poly){
  return seg_isect_poly(x,y,x+Math.E,y+PI,poly,true).length % 2 == 1;
}

// a contour made of overlapping feather tips: small arcs bulging out of the shape, with gaps
function feathered_edge(curve,step,amp,poly,ampf){
  let c = resample(curve,1);
  let o = [];
  let cur = [c[0]];
  let i = 0;
  while (i < c.length-1){
    let j = Math.min(c.length-1,i+Math.max(2,~~(step*(0.6+rand()*0.8))));
    let t = i/(c.length-1);
    let h = amp*(ampf?ampf(t):1)*(0.5+rand()*0.7);
    let a = c[i];
    let b = c[j];
    let ang = Math.atan2(b[1]-a[1],b[0]-a[0])+PI/2;
    let m = lerp2d(...a,...b,0.5);
    if (pt_in_poly(m[0]+Math.cos(ang)*0.5,m[1]+Math.sin(ang)*0.5,poly)){
      ang += PI;
    }
    if (noise(a[0]*0.08,a[1]*0.08,61) < 0.2){
      if (cur.length > 1){
        o.push(cur);
      }
      cur = [b];
      i = j;
      continue;
    }
    for (let k = i+1; k <= j; k++){
      let u = (k-i)/(j-i);
      let d = Math.pow(Math.sin(u*PI),0.7)*h;
      cur.push([c[k][0]+Math.cos(ang)*d,c[k][1]+Math.sin(ang)*d]);
    }
    i = j;
  }
  if (cur.length > 1){
    o.push(cur);
  }
  return o;
}

// small feather tips scattered over a shape
function feather_ticks(poly,scale,ang,dens){
  let samples = [];
  let bbox = get_bbox(poly);
  poissondisk(bbox.w,bbox.h,3.5*scale,samples);
  let out = [];
  for (let i = 0; i < samples.length; i++){
    let x = samples[i][0]+bbox.x;
    let y = samples[i][1]+bbox.y;
    if (rand() > dens(x,y)){
      continue;
    }
    let a = ang + (noise(x*0.03,y*0.03,13)-0.5)*1.5;
    let w = (1.0+rand()*0.8)*scale;
    let h = (1.6+rand()*1.2)*scale;
    let q = squama(w,h,0)[0];
    out.push(trsl_poly(rot_poly(q,a),x,y));
  }
  return clip_multi(out,poly).true;
}


function bird_body_curves(arg){
  let n = 32;
  let curve0 = [];
  let curve1 = [];
  let L = arg.body_length;
  let H = arg.body_height;
  for (let i = 0; i < n; i++){
    let t = i/(n-1);
    let p = Math.pow(Math.sin(PI*Math.pow(t,arg.body_skew)),0.75);
    let q = Math.pow(Math.sin(PI*Math.pow(t,arg.body_skew*0.85)),0.7);
    let x = 225 + (t-0.5)*L;
    let cy = 150 - arg.rear_rise*H*t*t;
    let w0 = (noise(t*7,11)-0.5)*H*0.1*Math.sin(t*PI);
    let w1 = (noise(t*7,12)-0.5)*H*0.12*Math.sin(t*PI);
    curve0.push([x, cy - p*H*lerp(0.75,1.1,noise(t*2,1)) + w0]);
    curve1.push([x, cy + q*H*arg.belly*lerp(0.75,1.1,noise(t*2,2)) + w1]);
  }
  return [curve0,curve1];
}

// a small dark teardrop: a sharp tip at -x and a round end at +x, turned by ang
function teardrop(x,y,l,w,ang){
  let o = [];
  for (let i = 0; i <= 16; i++){
    let a = i/16*PI*2;
    o.push([Math.cos(a)*l/2,Math.sin(a)*w*Math.pow((1+Math.cos(a))/2,0.7)]);
  }
  return trsl_poly(rot_poly(o,ang),x,y);
}

// dark marks scattered over the body, the sharp end toward the head: thrush spots or
// sparrow streaks. dens(s,t) gives the chance of a mark at height s (back 0, belly 1)
// and position t (breast 0, tail 1)
function body_marks(curve0,curve1,spacing,len,wid,dens){
  let outline = curve0.concat(curve1.slice().reverse());
  let bbox = get_bbox(outline);
  let samples = [];
  poissondisk(bbox.w,bbox.h,spacing,samples);
  let o = [];
  for (let i = 0; i < samples.length; i++){
    let x = samples[i][0]+bbox.x;
    let y = samples[i][1]+bbox.y;
    let yt = interp_y(curve0,x);
    let yb = interp_y(curve1,x);
    if (yt == null || yb == null || yb-yt < 1){
      continue;
    }
    let sv = (y-yt)/(yb-yt);
    if (sv < 0.05 || sv > 0.95 || rand() > dens(sv,(x-bbox.x)/bbox.w)){
      continue;
    }
    let d = teardrop(x,y,len*(0.7+rand()*0.6),wid*(0.7+rand()*0.6),0.35+(rand()-0.5)*0.3);
    o.push(d,...fill_shape(d,0.7));
  }
  return clip_multi(o,outline).true;
}

// streaked breast: thin dark streaks on the breast and flanks, none on the back or the belly
function bird_body_a(curve0,curve1,scale_scale){
  let marks = body_marks(curve0,curve1,7*scale_scale,5*scale_scale,1.1*scale_scale,(sv,t)=>(
    Math.max(0,Math.sin(PI*(sv-0.2)/0.7))*(1-t*0.6)*0.85
  ));
  return [curve0,curve1.slice().reverse(),...marks];
}

// feather fringes: staggered rows of short arcs, the edges of overlapping body feathers
function bird_body_b(curve0,curve1,scale_scale){
  let outline = curve0.concat(curve1.slice().reverse());
  let th = Math.max(...curve0.map((p,i)=>dist(...p,...curve1[i])));
  let ds = 6*scale_scale/th;
  let step = Math.max(3,~~(8*scale_scale));
  let o = [];
  let row = 0;
  for (let sv = ds; sv < 0.97; sv += ds, row++){
    let line = resample(curve0.map((p,i)=>lerp2d(...p,...curve1[i],sv)),1);
    for (let i = step+(row%2)*~~(step/2); i < line.length-step; i += step){
      if (rand() > 0.6-sv*0.35){
        continue;
      }
      let ang = Math.atan2(line[i+1][1]-line[i][1],line[i+1][0]-line[i][0]);
      let arc = squama(2.6*scale_scale,3.2*scale_scale,0)[0];
      arc = arc.slice(~~(rand()*2),6+~~(rand()*3));
      o.push(trsl_poly(rot_poly(arc,ang),...line[i]));
    }
  }
  return [curve0,curve1.slice().reverse(),...clip_multi(o,outline).true];
}

// soft down: scattered feather tips
function bird_body_c(curve0,curve1,scale_scale){
  let outline = curve0.concat(curve1.slice().reverse());
  let bbox = get_bbox(outline);
  let ticks = feather_ticks(outline,scale_scale,0,(x,y)=>{
    let t = (y-bbox.y)/bbox.h;
    return 0.35-t*0.3;
  });
  return [curve0,curve1.slice().reverse(),...ticks];
}

// transverse chevron bars
function bird_body_d(curve0,curve1,scale_scale){
  let outline = curve0.concat(curve1.slice().reverse());
  let bbox = get_bbox(outline);
  let step = 7*scale_scale;
  let o = [];
  for (let x = bbox.x+step; x < bbox.x+bbox.w; x += step){
    let yt = interp_y(curve0,x);
    let yb = interp_y(curve1,x);
    if (yt == null || yb == null){
      continue;
    }
    let chev = (yb-yt)*0.12;
    for (let k = 0; k < 2; k++){
      let bar = resample([[x+k*1.3,yt-2],[x-chev+k*1.3,(yt+yb)/2],[x+k*1.3,yb+2]],2);
      for (let j = 0; j < bar.length; j++){
        let [bx,by] = bar[j];
        bar[j][0] += (noise(bx*0.05,by*0.05,21)-0.5)*4;
      }
      o.push(...binclip(bar,(px,py,t)=>(noise(px*0.04,py*0.04,23)*(0.6+t*0.6) > 0.38)).true);
    }
  }
  o = clip_multi(o,outline).true;
  return [curve0,curve1.slice().reverse(),...o];
}


// the folded wing lying on the flank: lesser coverts, greater coverts, tertials, secondaries, primaries
function bird_wing(curve0,curve1,arg){
  let n = curve0.length;
  let L = arg.body_length;
  let H = arg.body_height;
  let iw = arg.wing_start;
  let ie = iw + ~~((n-1-iw)*0.32);
  let W = lerp2d(...curve0[iw],...curve1[iw],arg.wing_y);
  let E = lerp2d(...curve0[ie],...curve1[ie],0.1);
  let R = curve0[n-1];
  let T = [
    R[0] + Math.cos(arg.tail_angle)*arg.wing_reach*L,
    R[1] + Math.sin(arg.tail_angle)*arg.wing_reach*L - H*0.12,
  ];
  let ax = Math.atan2(T[1]-W[1],T[0]-W[0]);
  let dx = Math.cos(ax);
  let dy = Math.sin(ax);
  let down = [-dy,dx];
  let wl = dist(...W,...T);
  let proj = p=>((p[0]-W[0])*dx+(p[1]-W[1])*dy);
  let dark = arg.wing_dark;
  let ew = dist(...E,...W);

  let prim = [];
  let np = arg.primary_n;
  for (let k = np-1; k >= 0; k--){
    let s = k/(np-1);
    let b = [W[0]-down[0]*H*0.08*s, W[1]-down[1]*H*0.08*s];
    let st = (k+(rand()-0.5)*0.7)*arg.primary_step*wl;
    let tp = [
      T[0]-dx*st-down[0]*s*H*0.015,
      T[1]-dy*st-down[1]*s*H*0.015,
    ];
    let last = k == 0;
    prim.push({x:b[0],y:b[1],ang:Math.atan2(tp[1]-b[1],tp[0]-b[0]),len:dist(...b,...tp),wid:H*0.26,tip:0.9,lead:0.3,barbs:dark,bend:0.02,along:true,edge_from:last?0:0.35,solid:last});
  }

  let sec = [];
  let ns = arg.secondary_n;
  let send = arg.secondary_reach*wl;
  for (let j = 0; j < ns; j++){
    let s = j/(ns-1);
    let b = lerp2d(...E,...W,0.08+0.84*s);
    let len = Math.max(wl*0.15,send-proj(b)-s*wl*0.16+(rand()-0.5)*wl*0.05);
    b = [b[0]+down[0]*(rand()-0.5)*H*0.04,b[1]+down[1]*(rand()-0.5)*H*0.04];
    let last = j == ns-1;
    // the secondaries fan in toward the wing tip, so the wing narrows instead of ending in a stack
    let aim = [T[0]-dx*wl*0.35+down[0]*H*0.04,T[1]-dy*wl*0.35+down[1]*H*0.04];
    sec.push({x:b[0],y:b[1],ang:Math.atan2(aim[1]-b[1],aim[0]-b[0])+(rand()-0.5)*0.04,len,wid:Math.max(H*0.2,ew/ns*3),tip:0.3,lead:0.3,barbs:dark,bend:0.02,along:true,edge_from:last?0:0.45,solid:last});
  }

  let ter = [];
  for (let k = 0; k < arg.tertial_n; k++){
    let b = lerp2d(...E,...W,0.03+0.1*k);
    b = [b[0]-dx*wl*0.06, b[1]-dy*wl*0.06];
    let len = Math.max(wl*0.2,send-wl*0.04-proj(b)-k*wl*0.05);
    let aim = [T[0]-dx*wl*0.3,T[1]-dy*wl*0.3];
    ter.push({x:b[0],y:b[1],ang:Math.atan2(aim[1]-b[1],aim[0]-b[0])+(rand()-0.5)*0.05,len:len*(1+(rand()-0.5)*0.15),wid:H*(0.28+rand()*0.06),tip:0.45,lead:0.3,barbs:dark*0.8,bend:0.03,along:true,edge_from:0.6});
  }

  let gc = [];
  let gl = wl*0.2*arg.covert_scale;
  let ng = arg.covert_n;
  for (let j = 0; j < ng; j++){
    let s = j/(ng-1);
    let b = lerp2d(...E,...W,0.95*s);
    b = [b[0]-dx*gl*0.55, b[1]-dy*gl*0.55];
    gc.push({x:b[0],y:b[1],ang:ax+0.15*s,len:gl*(1-0.25*s),wid:Math.max(H*0.14,ew/ng*2.6),tip:0.1,lead:0.3,barbs:dark*0.9,bar_end:arg.has_wingbar?0.55:1,bend:0.02,edge_from:0.25});
  }

  // lesser coverts: a patch of small scallops at the shoulder
  let ce = [E[0]-dx*gl*0.4, E[1]-dy*gl*0.4];
  let cw = [W[0]-dx*gl*0.4, W[1]-dy*gl*0.4];
  let top = [];
  for (let i = iw+1; i < ie; i++){
    let p = lerp2d(...curve0[i],...curve1[i],0.1);
    if (p[0] < ce[0]){
      top.push(p);
    }
  }
  if (!top.length){
    top.push(lerp2d(...curve0[iw+1],...curve1[iw+1],0.1));
  }
  let sh = top[0];
  let lead_edge = bezier3(cw,[cw[0]-wl*0.12,cw[1]-H*0.05],[sh[0]-wl*0.06,sh[1]+H*0.12],sh,16);
  let region = top.concat([ce,cw]).concat(lead_edge.slice(1,-1));

  let rb = get_bbox(region);
  let us = 7*arg.plumage_scale;
  let mm = Math.max(3,~~(rb.w/us));
  let nn = Math.max(3,~~(rb.h/us));
  let sq = squama_mesh(mm,nn+3,rb.w/mm,rb.h/nn,(x,y,w,h)=>squama(w,h,0),rb.w/mm*2,rb.h/nn*2,true).map(a=>trsl_poly(a,rb.x,rb.y-rb.h/nn*1.5));
  sq = clip_multi(sq,region).true;
  sq = clip_multi(sq.map(x=>resample(x,1)),(x,y)=>(noise(x*0.15,y*0.15,33) > 0.15),binclip).true;

  let lines = [lead_edge,top.concat([ce])].concat(sq);
  let st = feather_stack(gc.concat(ter).concat(sec).concat(prim),[region]);
  return {lines:lines.concat(st.lines),occ:st.occ};
}


function tail_shape(type,s){
  if (type == 0){
    return 1-0.05*s;           // square
  }else if (type == 1){
    return 1-0.3*s*s;          // rounded
  }else if (type == 2){
    return 0.6+0.45*Math.pow(s,1.2); // forked
  }else if (type == 3){
    return 1-0.55*s;           // graduated
  }else{
    return s == 0 ? 1.8 : 0.75-0.15*s; // central streamer
  }
}

function bird_tail(curve0,curve1,arg){
  let n = curve0.length;
  let H = arg.body_height;
  let R0 = lerp2d(...curve0[n-6],...curve1[n-6],0.3);
  let R = curve0[n-1];
  let nt = arg.tail_n;
  let specs = [];
  for (let k = 0; k < nt; k++){
    let s = k/(nt-1);
    let a = arg.tail_angle + s*arg.tail_spread;
    let b = [R0[0], R0[1]+s*H*0.08];
    let len = dist(...b,...R) + arg.tail_length*tail_shape(arg.tail_type,s);
    let wid = arg.tail_width*((arg.tail_type == 4 && k == 0)?0.6:1);
    let last = k == nt-1;
    specs.push({x:b[0],y:b[1],ang:a,len,wid,tip:arg.tail_tip,lead:0.45,barbs:arg.tail_dark,bend:0.01,along:true,edge_from:last?0:0.3,solid:last});
  }
  return feather_stack(specs,[]);
}


// a beak built from a gape line with the two mandibles on either side. Besides length, depth,
// curvature and taper it can bend halfway (flamingo), hook (raptors), have the lower mandible
// outreach the upper (skimmer), carry serrations (toucan, merganser) or a blunt chisel tip
// (woodpecker)
function bird_beak(hp,hr,arg){
  let Lb = arg.beak_length*hr;
  let D = arg.beak_depth*hr;
  let f0 = hr*0.8;
  let v0 = -hr*0.08;
  let n = 48;
  let ue = arg.beak_upper_end;
  let le = arg.beak_hook > 0 ? 0.82 : 1;
  let shape = x=>Math.max(arg.beak_chisel,Math.pow(Math.max(0,1-x),arg.beak_taper));
  let C = u=>[
    f0+Lb*u,
    v0-arg.beak_curve*Lb*u*u
      -arg.beak_kink*Lb*Math.pow(Math.max(0,u-0.45),1.3)
      -arg.beak_hook*D*Math.pow(Math.max(0,(u-0.7)/0.3),2),
  ];
  let hU = u=>D*0.55*shape(u/ue);
  let hL = u=>D*0.45*shape(u/le);
  // thickness is measured across the beak's own curve, so hooks stay thick to the tip
  let nrm = u=>{
    let a = C(Math.max(0,u-0.002));
    let b = C(Math.min(1,u+0.002));
    let l = Math.hypot(b[0]-a[0],b[1]-a[1]);
    return [-(b[1]-a[1])/l,(b[0]-a[0])/l];
  };

  let top = [];
  let gape = [];
  let ltop = [];
  let bot = [];
  // a singing bird opens its beak: the lower mandible swings down about the corner of the gape
  let ca = Math.cos(arg.beak_open);
  let sa = Math.sin(arg.beak_open);
  let swing = (f,v)=>hp(f0+(f-f0)*ca+(v-v0)*sa,v0-(f-f0)*sa+(v-v0)*ca);
  for (let i = 0; i < n; i++){
    let u = i/(n-1);
    let [f,v] = C(u);
    let [nf,nv] = nrm(u);
    if (u <= ue+1e-6){
      top.push(hp(f+nf*hU(u),v+nv*hU(u)));
      gape.push(hp(f,v));
    }
    if (u <= le+1e-6){
      ltop.push(swing(f,v));
      bot.push(swing(f-nf*hL(u),v-nv*hL(u)));
    }
  }
  let upper = top.concat(gape.slice().reverse());
  let lower = ltop.concat(bot.slice().reverse());

  // the cutting edge, saw-toothed on serrated beaks
  let edge = gape.map((p,i)=>{
    let u = i/(n-1);
    if (!arg.beak_serrate || u < 0.1 || u > ue*0.9){
      return p;
    }
    let z = Math.abs(((u*Lb/(D*0.12))%2)-1)*D*0.08*arg.beak_serrate;
    let [f,v] = C(u);
    let [nf,nv] = nrm(u);
    return hp(f-nf*z,v-nv*z);
  });

  // feathers of the face overlap the base of the beak
  let base = bezier3(top[0],hp(f0-hr*0.1,v0+D*0.25),hp(f0-hr*0.1,v0-D*0.25),bot[0],10);
  let face = base.concat([hp(f0-hr*0.6,v0)]);
  let lines = [top,edge,bot,...feathered_edge(base,3,Math.min(2,D*0.12),face)];
  let occ = [upper,lower];
  if (arg.beak_open){
    // the open mouth is dark inside
    let mouth = gape.slice(0,~~(gape.length*0.5)).concat(ltop.slice(0,~~(ltop.length*0.5)).reverse());
    lines.push(ltop,...fill_shape(mouth,1));
    occ.push(mouth);
  }
  if (arg.beak_chisel){
    lines.push([top[top.length-1],gape[gape.length-1]],[ltop[ltop.length-1],bot[bot.length-1]]);
  }

  let o = hp(0,0);
  let fx = hp(1,0);
  let th = Math.atan2(fx[1]-o[1],fx[0]-o[0]);
  let un = Math.min(0.4,Math.max(0.12,(hr*1.05-f0)/Lb));
  let [nf,nv] = C(un);
  let nr = Math.min(D*0.14,Lb*0.08);
  let nostril = ellipse(...hp(nf+nr,nv+hU(un)*0.6),nr,nr*0.45,th,12);
  lines.push(nostril);

  if (arg.beak_cere){
    let uc = arg.beak_cere;
    let [cf,cv] = C(uc);
    let cd = hU(uc);
    lines.push(bezier3(hp(cf,cv+cd),hp(cf+cd*0.3,cv+cd*0.6),hp(cf+cd*0.3,cv+cd*0.2),hp(cf,cv),8));
  }

  let hatch = [];
  if (arg.beak_dark >= 1){
    hatch.push(...fill_shape(upper,1.3));
  }
  if (arg.beak_dark >= 2){
    hatch.push(...fill_shape(lower,1.3));
  }else{
    hatch.push(...shade_shape(lower,2,3,3));
  }
  hatch = clip_multi(hatch,nostril).false;
  lines.push(...hatch);

  return {lines,occ};
}


function bird_head(cx,cy,arg,Pb,Pf){
  let hr = arg.head_size;
  let ha = arg.head_angle;
  let dir = [-Math.cos(ha), Math.sin(ha)];
  let up  = [-Math.sin(ha),-Math.cos(ha)];
  let hp = (f,v)=>[cx+dir[0]*f+up[0]*v, cy+dir[1]*f+up[1]*v];
  let hl = (x,y)=>{
    let dx = x-cx;
    let dy = y-cy;
    return [(dx*dir[0]+dy*dir[1])/hr,(dx*up[0]+dy*up[1])/hr];
  };
  // the head is a smooth oval through anatomical landmarks (in units of the head radius):
  // the beak base, a forehead that rises into a domed crown, the nape, the throat and the chin
  let v0 = -0.08;
  let bd = arg.beak_depth;
  let ch = arg.crown_flat;
  let fh = Math.max(0.15,0.75-arg.forehead*2-0.15*Math.min(1,Math.max(0,arg.beak_length-1.2)));
  let marks = [
    [0.84, v0+bd/2],                            // top of the beak base
    [0.55, lerp(v0+bd/2,ch,fh)],                // forehead
    [arg.crown_pos, ch],                        // crown, the highest point
    [arg.crown_pos-0.6, ch*0.85+arg.nape*0.5],  // back of the crown
    [-0.98, 0.28+arg.nape],                     // nape
    [-0.95,-0.35],                              // back of the head, hidden by the neck
    [-0.35,-0.82-arg.cheek],                    // throat
    [0.45,-0.6],                                // chin
    [0.84, v0-bd/2],                            // bottom of the beak base
  ];
  for (let i = 0; i < marks.length; i++){
    marks[i] = [
      marks[i][0]+(noise(i*0.7,arg.head_size*0.1,71)-0.5)*0.08,
      marks[i][1]+(noise(i*0.7,arg.head_size*0.1,72)-0.5)*0.08,
    ];
  }
  let seg = 6;
  let outline = catmull_closed(marks,seg).map(([f,v])=>{
    let z = (noise(f*3+5,v*3+5,73)-0.5)*0.03;
    return hp((f+z)*hr,(v+z)*hr);
  });
  let n = outline.length;
  let iC = 2*seg;
  let iN = 4*seg;
  let iT = 6*seg;

  // the neck leaves the head where a line from the body just grazes it,
  // so nape and throat run on without a corner or a double chin
  let tangent = (P,i0,i1,sign,fallback)=>{
    if (pt_in_poly(...P,outline)){
      return fallback;
    }
    let c = [cx-P[0],cy-P[1]];
    let lc = Math.hypot(...c);
    let best = fallback;
    let bv = -Infinity;
    for (let i = i0; i <= i1; i++){
      let d = [outline[i][0]-P[0],outline[i][1]-P[1]];
      let v = sign*(c[0]*d[1]-c[1]*d[0])/(lc*Math.hypot(...d));
      if (v > bv){
        bv = v;
        best = i;
      }
    }
    return best;
  };
  if (Pb){
    iN = tangent(Pb,iC+1,iT-2,1,iN);
    iT = tangent(Pf,iN+2,7*seg,-1,iT);
  }

  let beak = bird_beak(hp,hr,arg);

  // the eye sits about one eye-width behind the beak base, level with the top of the beak
  let er = arg.eye_size*hr;
  let ef_ = 0.84-2.6*arg.eye_size;
  let ev_ = Math.min(ch-arg.eye_size-0.3,v0+bd*0.3+0.1);
  let ec = hp(ef_*hr,ev_*hr);
  // pale irises belong to raptors and herons; most birds have dark eyes
  let pale = arg.eye_type && (['raptorial','scavenging'].includes(BEAKS[arg.beak_type].name) || arg.leg_type == 1);
  let [eye0,ef] = bird_eye(...ec,er,pale);
  let eocc = [eye0];
  let ring = [];
  if (arg.has_eyering){
    let r = ellipse(...ec,er*1.45,er*1.45,0,30);
    ring = clip(r,eye0).false;
    eocc.push(r);
  }

  let mark = (x,y)=>{
    let [f,v] = hl(x,y);
    if (arg.cap_type == 1 && v > ev_+0.22-0.15*(f-ef_)){
      return true;
    }
    if (arg.cap_type == 2 && v > -0.35-0.2*f){
      return true;
    }
    if (arg.has_eyestripe && Math.abs(v-ev_-0.25*(f-ef_)) < 0.1 && f < 1.0){
      return true;
    }
    if (arg.has_malar && pt_seg_dist([f,v],[0.75,-0.25],[-0.1,-0.8]) < 0.09){
      return true;
    }
    if (arg.has_bib && v < -0.4 && v > -2.2 && f > -0.35 + 0.25*v){
      return true;
    }
    return false;
  };

  let back = Math.atan2(-dir[1],-dir[0]);
  let tx = feather_ticks(outline,0.7,back,(x,y)=>{
    let [f,v] = hl(x,y);
    return 0.03+Math.max(0,-f)*0.12;
  });
  // engraved lines follow the crown down the nape, and a few follow the throat
  let sh = contour_shade(outline.slice(iC-seg/2,iN+seg+1),outline,[cx,cy],2.4,4)
    .concat(contour_shade(outline.slice(iT-seg/2,iT+seg+seg/2),outline,[cx,cy],2.4,2,0.25));
  let mk = patternshade_shape(outline,2.4,mark);
  let tex = clip_out(tx.concat(sh).concat(mk),eocc);

  // the back of the head is not drawn: the contour runs from the throat over the face to the nape
  let face = outline.slice(iT).concat(outline.slice(0,iC+1));
  let crown = feathered_edge(outline.slice(iC,iN+1),4,hr*0.05,outline,t=>Math.sqrt(t));
  let head = {
    lines:[face,...crown,...ef,...ring,...tex],
    occ:[outline],
  };

  let crest = {lines:[],occ:[]};
  if (arg.crest_type == 1){
    let specs = [];
    let nc = 5;
    for (let k = 0; k < nc; k++){
      let s = k/(nc-1);
      let a = lerp(0.4,0.8,s)*PI;
      let b = hp(Math.cos(a)*hr*0.55,Math.sin(a)*hr*0.55*arg.crown_flat);
      let al = lerp(0.7,0.25,s);
      let vx = -dir[0]*Math.cos(al)+up[0]*Math.sin(al);
      let vy = -dir[1]*Math.cos(al)+up[1]*Math.sin(al);
      specs.push({x:b[0],y:b[1],ang:Math.atan2(vy,vx),len:hr*arg.crest_length*lerp(1.3,0.8,s),wid:hr*0.4,tip:0.6,lead:0.4,barbs:0.4,bend:0.06});
    }
    crest = feather_stack(specs,[]);
  }else if (arg.crest_type == 2){
    let specs = [];
    for (let k = 0; k < 3; k++){
      let a = (0.8+k*0.06)*PI;
      let b = hp(Math.cos(a)*hr*0.6,Math.sin(a)*hr*0.6);
      let al = -0.35-k*0.18;
      let vx = -dir[0]*Math.cos(al)+up[0]*Math.sin(al);
      let vy = -dir[1]*Math.cos(al)+up[1]*Math.sin(al);
      specs.push({x:b[0],y:b[1],ang:Math.atan2(vy,vx),len:hr*arg.crest_length*(2.4-k*0.4),wid:hr*0.14,tip:1,lead:0.5,bend:0.1,rachis:false});
    }
    crest = feather_stack(specs,[]);
  }

  return {beak,head,crest,outline,mark,hl,dir,hr,iN,iT};
}


function bird_neck(h,Pb,tb,Pf,tf){
  let o = h.outline;
  let nn = o.length;
  let iN = h.iN;
  let iT = h.iT;
  let Hn = o[iN];
  let Ht = o[iT];
  let tang = (i,target)=>{
    let a = o[(i+1)%nn];
    let b = o[(i-1+nn)%nn];
    let l = dist(...a,...b);
    let t = [(a[0]-b[0])/l,(a[1]-b[1])/l];
    if ((target[0]-o[i][0])*t[0]+(target[1]-o[i][1])*t[1] < 0){
      t = [-t[0],-t[1]];
    }
    return t;
  };
  let dn = dist(...Hn,...Pb)*0.4;
  let dt = dist(...Ht,...Pf)*0.4;
  let th = tang(iN,Pb);
  let tt = tang(iT,Pf);
  let nape = bezier3(Hn,[Hn[0]+th[0]*dn,Hn[1]+th[1]*dn],[Pb[0]+tb[0]*dn,Pb[1]+tb[1]*dn],Pb,24);
  let throat = bezier3(Ht,[Ht[0]+tt[0]*dt,Ht[1]+tt[1]*dt],[Pf[0]+tf[0]*dt,Pf[1]+tf[1]*dt],Pf,24);
  // the neck is not a clean tube: let its contours wander
  let wander = (c,z)=>c.map((p,i)=>{
    let t = i/(c.length-1);
    let a = c[Math.min(i+1,c.length-1)];
    let b = c[Math.max(i-1,0)];
    let ang = Math.atan2(a[1]-b[1],a[0]-b[0])+PI/2;
    let d = (noise(t*3,z)-0.5)*h.hr*0.35*Math.sin(t*PI);
    return [p[0]+Math.cos(ang)*d,p[1]+Math.sin(ang)*d];
  });
  nape = wander(nape,41);
  throat = wander(throat,42);
  let poly = nape.concat(throat.slice().reverse());

  let back = Math.atan2(-h.dir[1],-h.dir[0]);
  let tx = feather_ticks(poly,0.7,back+0.8,(x,y)=>0.05);
  let mid = lerp2d(...nape[~~(nape.length/2)],...throat[~~(throat.length/2)],0.5);
  let sh = contour_shade(nape,poly,mid,2.4,3,0.05);
  let mk = patternshade_shape(poly,2.4,h.mark);
  let throat_edge = feathered_edge(throat,5,1.6,poly,t=>Math.sin(t*PI));
  return {lines:[nape,...throat_edge,...tx,...sh,...mk],occ:[poly]};
}


function bird_toe(x,y,a0,curl,len,w){
  let m = Math.max(6,~~(len/1.2));
  let path = [[x,y]];
  let a = a0;
  for (let i = 1; i < m; i++){
    let u = i/(m-1);
    a = a0 + curl*u + (u > 0.75 ? curl*0.8*(u-0.75)/0.25 : 0);
    x += Math.cos(a)*len/(m-1);
    y += Math.sin(a)*len/(m-1);
    path.push([x,y]);
  }
  let wf = u=>(u < 0.75 ? w*(1+0.15*Math.sin(u*PI*5)) : w*0.75*Math.pow(1-(u-0.75)/0.25,0.8));
  let [l,r] = tube(path,wf);
  let poly = l.concat(r.slice().reverse());
  let lines = [poly.slice()];
  let step = Math.max(1,~~(m*w*1.3/len));
  for (let i = step; i < ~~(m*0.72); i += step+~~(rand()*1.6)){
    let c = lerp2d(...l[i],...r[i],0.5);
    lines.push([l[i],[c[0]+(rand()-0.5)*w*0.4,c[1]+(rand()-0.5)*w*0.4],r[i]]);
  }
  let claw = l.slice(~~(m*0.75)).concat(r.slice(~~(m*0.75)).reverse());
  if (claw.length > 3){
    lines.push(...fill_shape(claw,0.8));
  }
  return {poly,lines};
}

function bird_leg(hip,foot,arg,perch_type){
  let H = arg.body_height;
  let tw = arg.leg_width*H*0.045;
  let path;
  let knee;
  if (arg.leg_type == 1){
    let heel = [lerp(hip[0],foot[0],0.5)+H*0.22, lerp(hip[1],foot[1],0.45)];
    path = resample([hip,heel,foot],2);
    knee = heel;
  }else{
    let mid = [lerp(hip[0],foot[0],0.4)+H*0.12, lerp(hip[1],foot[1],0.4)];
    path = resample(bezier3(hip,mid,mid,foot,12),2);
    knee = mid;
  }
  let [l,r] = tube(path,u=>tw*(u < 0.05 ? 1.6 : 1));
  let leg_poly = l.concat(r.slice().reverse());
  let leg_lines = [l,r];
  for (let i = 0; i < path.length; i += 1+~~(rand()*2.2)){
    if (path[i][1] > knee[1]){
      let m = lerp2d(...l[i],...r[i],0.5);
      let s0 = rand() < 0.2 ? lerp2d(...l[i],...r[i],0.4) : l[i];
      leg_lines.push([s0,[m[0],m[1]+tw*0.3*(rand()+0.3)],r[i]]);
    }
  }
  leg_lines.push(...shade_shape(leg_poly,1.6,2,2));

  let tl = arg.toe_length*H*0.38;
  let toes = [];
  let [fx,fy] = foot;
  if (perch_type == 0){
    let curl = Math.min(2.2,tl/(arg.perch_size*H*0.18)*0.5);
    toes.push(bird_toe(fx,fy,PI+0.15,-curl,tl,tw*0.85));
    toes.push(bird_toe(fx+1,fy+1,0.2,curl*0.8,tl*0.65,tw*0.85));
    toes.push(bird_toe(fx-1,fy,PI-0.35,-curl*0.8,tl*0.8,tw*0.8));
  }else{
    toes.push(bird_toe(fx,fy,PI-0.05,-0.15,tl*1.2,tw*0.85));
    toes.push(bird_toe(fx+1,fy,0.05,0.1,tl*0.6,tw*0.85));
    toes.push(bird_toe(fx-1,fy+1,PI-0.5,-0.1,tl*0.75,tw*0.8));
  }
  let st = {lines:[],occ:[]};
  for (let i = 0; i < toes.length; i++){
    st.lines.push(...clip_out(toes[i].lines,st.occ));
    st.occ.push(toes[i].poly);
  }
  st.lines.push(...clip_out(leg_lines,st.occ));
  st.occ.push(leg_poly);
  return st;
}


function bird_perch(xa,xb,ytop,br,arg){
  if (arg.perch_type == 1){
    let ground = [];
    for (let x = xa; x <= xb; x += 3){
      ground.push([x,ytop(x)]);
    }
    let lines = [ground];
    let bot = ytop(xa)+br*4;
    for (let i = 0; i < (xb-xa)/4; i++){
      let x = lerp(xa,xb,rand());
      let d = Math.pow(rand(),2)*br*3;
      let y = ytop(x)+2+d;
      let w = (2+rand()*6)*(1-d/(br*3));
      if (w > 1){
        lines.push([[x,y],[x+w,y+rand()*0.6-0.3]]);
      }
    }
    for (let k = 0; k < 6; k++){
      let x = lerp(xa,xb,rand());
      let y = ytop(x);
      for (let j = 0; j < 5; j++){
        let lean = (rand()-0.5)*1.2;
        let h = br*(1+rand()*1.5);
        lines.push(bezier3([x+j*1.5,y],[x+j*1.5,y-h*0.5],[x+j*1.5+lean*h*0.3,y-h*0.8],[x+j*1.5+lean*h*0.6,y-h],6));
      }
    }
    let occ = ground.concat([[xb,bot],[xa,bot]]);
    return {lines,occ:[occ]};
  }

  let n = ~~((xb-xa)/3);
  let top = [];
  let bot = [];
  let th = [];
  for (let i = 0; i < n; i++){
    let t = i/(n-1);
    let x = lerp(xa,xb,t);
    let taper = t > 0.7 ? 0.25+0.75*Math.pow(Math.max(0,1-(t-0.7)/0.3),0.7) : 1;
    let y = ytop(x);
    let w = 2*br*taper*(1+(noise(x*0.02,7)-0.5)*0.4+(noise(x*0.1,9)-0.5)*0.12);
    top.push([x,y]);
    bot.push([x,y+w]);
    th.push(w);
  }
  let outline = top.concat(bot.slice().reverse());
  let frac = (x,y)=>{
    let i = Math.max(0,Math.min(n-1,Math.round((x-xa)/(xb-xa)*(n-1))));
    return (y-top[i][1])/th[i];
  };

  let lines = [top,bot,[top[n-1],bot[n-1]]];

  // cut end with growth rings
  let ry = th[0]/2;
  let ecx = xa;
  let ecy = top[0][1]+ry;
  let cut = ellipse(ecx,ecy,ry*0.35,ry,0,30);
  let cut_lines = [cut];
  for (let k = 1; k < 3; k++){
    let s = 1-k*0.33;
    let e = ellipse(ecx+(rand()-0.5)*0.5,ecy+(rand()-0.5)*ry*0.2,ry*0.35*s,ry*s,0,24);
    cut_lines.push(...binclip(e,()=>rand()<0.8).true);
  }

  // bark
  let bark = [];
  for (let s = 0.12; s < 0.95; s += 0.11){
    let b = [];
    for (let i = 0; i < n; i++){
      b.push(lerp2d(...top[i],...bot[i],s+(noise(i*0.05,s*10,17)-0.5)*0.15));
    }
    b = resample(b,2);
    bark.push(...binclip(b,(x,y)=>(noise(x*0.03,y*0.1,19) > 0.42)).true);
  }
  let knots = [];
  for (let k = 0; k < 2; k++){
    let i = ~~(lerp(0.15,0.65,rand())*n);
    let kn = ellipse(top[i][0],top[i][1]+th[i]*lerp(0.35,0.6,rand()),th[i]*0.25,th[i]*0.12,0,16);
    knots.push(kn);
  }
  bark = clip_multi(bark,outline).true;
  bark = clip_out(bark,knots);
  lines.push(...knots,...bark);

  let shade = fill_shape(outline,2.2);
  shade = clip_multi(shade.map(x=>resample(x,1)),(x,y)=>(frac(x,y) > 0.62 + rand()*0.1),binclip).true;
  lines.push(...clip_out(shade,knots));

  lines = cut_lines.concat(clip_out(lines,[cut]));

  return {lines,occ:[outline,cut]};
}


// still water: the surface line where the bird floats, and engraved ripple lines below it
// that open up toward the viewer. Everything below the surface is hidden
function bird_water(xa,xb,yw,arg){
  let H = arg.body_height;
  let lines = [];
  let gap = 2.4;
  let k = 0;
  for (let y = yw; y < yw+H*1.1; y += gap, gap *= 1.22, k++){
    let line = [];
    for (let x = xa; x <= xb; x += 2){
      line.push([x,y+(k ? (noise(x*0.04,k*3.1,81)-0.5)*1.6 : 0)]);
    }
    let z = rand()*100;
    let kk = k;
    lines.push(...binclip(line,(x,y,t)=>(
      kk == 0 ? noise(x*0.05,z) > 0.12 : noise(x*0.03,z)*Math.sin(t*PI) > 0.3+kk*0.02
    )).true);
  }
  let occ = [[xa-1e4,yw],[xb+1e4,yw],[xb+1e4,yw+1e4],[xa-1e4,yw+1e4]];
  return {lines,occ:[occ]};
}


function bird(arg){
  let L = arg.body_length;
  let H = arg.body_height;
  let [curve0,curve1] = bird_body_curves(arg);
  let n = curve0.length;
  let outline = curve0.concat(curve1.slice().reverse());

  // pattern overlays: 1 spots on the breast, 2 mottling, 3 faint bars
  let ps = arg.plumage_scale;
  let pattern_func = null;
  if (arg.pattern_type == 2){
    pattern_func = (x,y)=>{
      return (noise(x*0.1,y*0.1) * Math.max(0.35,(y-10)/280) ) < 0.2 ;
    };
  }else if (arg.pattern_type == 3){
    let period = 16*arg.pattern_scale;
    pattern_func = (x,y)=>{
      let dx = noise(x*0.01,y*0.01)*30;
      return ((x+dx)%period+period)%period < period*0.22;
    };
  }

  let bd;
  if (arg.plumage_type == 0){
    bd = bird_body_a(curve0,curve1,ps);
  }else if (arg.plumage_type == 1){
    bd = bird_body_b(curve0,curve1,ps);
  }else if (arg.plumage_type == 2){
    bd = bird_body_c(curve0,curve1,ps);
  }else{
    bd = bird_body_d(curve0,curve1,ps);
  }
  let sh = form_shade(curve0,curve1,3.2);
  let sh2 = pattern_func ? patternshade_shape(outline,3.5,pattern_func) : [];
  let sh3 = [];
  if (arg.pattern_type == 1){
    sh3 = body_marks(curve0,curve1,11*ps,5.5*ps*arg.pattern_scale,2.3*ps*arg.pattern_scale,(sv,t)=>(
      (sv > 0.3 && sv < 0.88 && t < 0.75) ? 0.75 : 0
    ));
  }

  let wing = bird_wing(curve0,curve1,arg);
  let tail = bird_tail(curve0,curve1,arg);

  // the body is drawn level, then tilted to the bird's posture
  let R = p=>rot_around(p,arg.tilt,225,150);
  let Rp = p=>R([p])[0];
  // the plain contours are replaced by feather tips: soft on the belly, tight along the back
  let edges = feathered_edge(curve1,6*ps,2.2,outline,t=>0.2+0.8*Math.sin(t*PI))
    .concat(feathered_edge(curve0,7*ps,1,outline,t=>Math.sin(t*PI)));
  let body_lines = bd.slice(2).concat(sh,sh2,sh3);

  // flank feathers lie over the lower edge of the folded wing
  let iw = arg.wing_start;
  // breast feathers cover the bend of the wing; further back the wing's lower edge lies free
  let ie = iw+2+~~((n-iw)*0.3);
  let ftop = [];
  for (let i = iw+1; i <= ie; i++){
    let u = (i-iw-1)/(ie-iw-1);
    let sf = Math.min(0.97,lerp(arg.wing_y+0.2,1,Math.pow(u,1.3))+(noise(u*3,62)-0.5)*0.06);
    ftop.push(lerp2d(...curve0[i],...curve1[i],sf));
  }
  let fpoly = ftop.concat(curve1.slice(iw+1,ie+1).reverse());
  let texture = bd.slice(2).concat(sh2,sh3);
  let flank = {
    lines:feathered_edge(ftop,6*ps,2.4,fpoly,t=>1-t)
      .concat(clip_multi(sh,fpoly).true)
      .concat(clip_out(clip_multi(texture,fpoly).true,wing.occ))
      .map(R),
    occ:[R(fpoly)],
  };
  // back feathers (scapulars) drape over the top of the folded wing, hiding the roots of its upper feathers
  let is0 = iw+1;
  let is1 = Math.min(n-3,~~lerp(iw,n-1,0.6));
  let sbot = [];
  for (let i = is0; i <= is1; i++){
    let u = (i-is0)/(is1-is0);
    let sb = lerp(0.1,0.24,Math.sin(u*PI))+(noise(u*3,63)-0.5)*0.05;
    sbot.push(lerp2d(...curve0[i],...curve1[i],sb));
  }
  let spoly = curve0.slice(is0,is1+1).concat(sbot.slice().reverse());
  let scap = {
    lines:feathered_edge(sbot,6*ps,2.2,spoly).concat(clip_multi(sh,spoly).true).map(R),
    occ:[R(spoly)],
  };
  let body = {lines:body_lines.concat(edges).map(R),occ:[R(outline)]};
  wing = {lines:wing.lines.map(R),occ:wing.occ.map(R)};
  tail = {lines:tail.lines.map(R),occ:tail.occ.map(R)};
  let c0 = curve0.map(Rp);
  let c1 = curve1.map(Rp);

  let unit = (a,b)=>{
    let l = dist(...a,...b);
    return [(b[0]-a[0])/l,(b[1]-a[1])/l];
  };
  let kb = arg.neck_back;
  let kf = arg.neck_front;
  let Pb = c0[kb];
  let Pf = c1[kf];
  let tb = unit(c0[kb+1],c0[kb-1]);
  let tf = unit(c1[kf+1],c1[kf-1]);
  let hr = arg.head_size;
  let nd = [-Math.sin(arg.neck_angle),-Math.cos(arg.neck_angle)];
  let hc = [Pb[0]+nd[0]*(hr*0.2+arg.neck_length)-hr*0.25, Pb[1]+nd[1]*(hr*0.2+arg.neck_length)];

  // on the body side too, the neck meets the outline where a line from the head grazes it,
  // so the breast and back run on into the throat and nape without a bulge
  let bc = Rp([225,150]);
  let graze = (curve,i0,i1,sign)=>{
    let c = [bc[0]-hc[0],bc[1]-hc[1]];
    let best = i0;
    let bv = -Infinity;
    for (let i = i0; i <= i1; i++){
      let d = [curve[i][0]-hc[0],curve[i][1]-hc[1]];
      let v = sign*(c[0]*d[1]-c[1]*d[0])/(Math.hypot(...c)*Math.hypot(...d));
      if (v > bv){
        bv = v;
        best = i;
      }
    }
    return best;
  };
  kb = graze(c0,1,14,-1);
  kf = graze(c1,1,16,1);
  Pb = c0[kb];
  Pf = c1[kf];
  tb = unit(c0[kb+1],c0[kb-1]);
  tf = unit(c1[kf+1],c1[kf-1]);
  let h = bird_head(...hc,arg,Pb,Pf);
  let neck = bird_neck(h,Pb,tb,Pf,tf);

  let front = [h.beak,h.head,h.crest,neck];
  let bird_layers = [scap,flank,wing,body,tail];
  let xs = c0.concat(c1).map(p=>p[0]);

  if (arg.pose == 2){
    // swimming: no legs; the water hides the lower body
    let ys = c0.concat(c1).map(p=>p[1]);
    let yw = Math.max(...ys)-(Math.max(...ys)-Math.min(...ys))*arg.water_depth;
    let water = bird_water(Math.min(...xs)-L*0.5,Math.max(...xs)+L*0.5,yw,arg);
    // the water hides the neck and body below the surface; the head and beak stay in front of it
    return compose([h.beak,h.head,h.crest,water,neck].concat(bird_layers));
  }

  let kl = arg.leg_pos;
  let hip0 = lerp2d(...c0[kl],...c1[kl],0.65);
  let hip1 = lerp2d(...c0[kl+2],...c1[kl+2],0.65);

  let bottom = Math.max(...c1.map(p=>p[1]));
  let py = bottom + arg.leg_length*H;
  let fx0 = hip0[0]+arg.foot_dx*H;
  let fx1 = hip1[0]+arg.foot_dx*H+H*0.12;
  let br = arg.perch_size*H*0.18;
  let ytop;
  if (arg.perch_type == 0){
    ytop = x=>py+arg.perch_slope*(x-fx0)+(noise(x*0.01,5.5)-0.5)*H*0.12+(noise(x*0.06,8.5)-0.5)*H*0.04;
  }else{
    ytop = x=>py+arg.perch_slope*0.3*(x-fx0)+(noise(x*0.03,5.5)-0.5)*H*0.06;
  }
  let leg0 = bird_leg(hip0,[fx0,ytop(fx0)],arg,arg.perch_type);
  let leg1 = bird_leg(hip1,[fx1,ytop(fx1)],arg,arg.perch_type);

  let hx = h.outline.map(p=>p[0]);
  let xa = Math.min(...xs,...hx,fx0) - L*lerp(0.15,0.4,rand());
  let xb = Math.max(...xs,fx1) + L*lerp(0.05,0.3,rand());
  let perch = bird_perch(xa,xb,ytop,br,arg);

  return compose(front.concat(bird_layers,[leg0,leg1,perch]));
}

function reframe(polylines,pad=20,text=null){
  
  let W = (500-pad*2);
  let H = (300-pad*2) - (text?10:0);
  let bbox = get_bbox(polylines.flat());
  let sw = W/bbox.w;
  let sh = H/bbox.h;
  let s = Math.min(sw,sh);
  let px = (W-bbox.w*s)/2;
  let py = (H-bbox.h*s)/2;
  for (let i = 0; i < polylines.length; i++){
    for (let j = 0; j < polylines[i].length; j++){
      let [x,y] = polylines[i][j];
      x = (x - bbox.x) * s + px+pad;
      y = (y - bbox.y) * s + py+pad;
      polylines[i][j] = [x,y];
    }
  }
  let [tw,tp] = put_text(text);
  tp = tp.map(p=>scl_poly(shr_poly(p,-0.3),0.3,0.3));
  tw *= 0.3;
  polylines.push(...tp.map(p=>trsl_poly(p,250-tw/2,300-pad+5)));
  return polylines;
}

function cleanup(polylines){
  for (let i = polylines.length-1; i>=0; i--){
    polylines[i] = approx_poly_dp(polylines[i],0.1);
    for (let j = 0; j < polylines[i].length; j++){
      for (let k = 0; k < polylines[i][j].length; k++){
        polylines[i][j][k] = ~~(polylines[i][j][k]*10000)/10000;
      }
    }
    if (polylines[i].length < 2){
      polylines.splice(i,1);
      continue;
    }
    if (polylines[i].length == 2){
      if (dist(...polylines[0],...polylines[1])<0.9){
        polylines.splice(i,1);
        continue;
      }
    }
  }
  return polylines;
}


// beaks after the feeding guilds of Wikipedia's chart File:BirdBeaksA.svg. Lengths and depths
// are in head radii as [min, mode, max]; w is how often the beak is picked (fruit eating,
// and filter feeding are rare)
const BEAKS = [
  {name:'generalist',      w:3, length:[1.2,1.5,1.9],   depth:[0.5,0.58,0.68],   curve:[0.04,0.08,0.12],   taper:[0.9,1,1.1]},
  {name:'insect catching', w:3, length:[0.55,0.75,0.95],depth:[0.24,0.3,0.36],   curve:[0,0.02,0.05],      taper:[1,1.15,1.3]},
  {name:'grain eating',    w:3, length:[0.6,0.75,0.9],  depth:[0.65,0.8,0.95],   curve:[0.04,0.08,0.14],   taper:[0.8,0.9,1]},
  {name:'nectar feeding',  w:2, length:[1.8,2.4,3.2],   depth:[0.18,0.22,0.26],  curve:[0.18,0.26,0.36],   taper:[0.6,0.7,0.8]},
  {name:'fruit eating',    w:1, length:[2.6,3.2,3.9],   depth:[1.1,1.3,1.5],     curve:[0.08,0.12,0.16],   taper:[0.5,0.6,0.7],   hook:0.15, serrate:1},
  {name:'chiseling',       w:2, length:[1.4,1.7,2.1],   depth:[0.4,0.46,0.52],   curve:[-0.01,0,0.01],     taper:[0.9,1,1.1],     chisel:0.18},
  {name:'surface skimming',w:2, length:[2.2,2.6,3],     depth:[0.45,0.5,0.55],   curve:[0,0.02,0.04],      taper:[0.9,1,1.1],     upper_end:0.72},
  {name:'scything',        w:2, length:[2.2,2.7,3.2],   depth:[0.16,0.19,0.22],  curve:[-0.3,-0.22,-0.15],taper:[0.6,0.7,0.8]},
  {name:'probing',         w:3, length:[2,2.8,3.8],     depth:[0.24,0.28,0.32],  curve:[0.15,0.22,0.3],    taper:[0.6,0.7,0.8]},
  {name:'filter feeding',  w:1, length:[1.7,2,2.3],     depth:[0.75,0.85,0.95],  curve:[0,0.02,0.04],      taper:[0.5,0.6,0.7],   kink:0.6},
  {name:'aerial fishing',  w:3, length:[1.8,2.4,3],     depth:[0.38,0.44,0.5],   curve:[-0.01,0,0.02],     taper:[0.9,1,1.1]},
  {name:'pursuit fishing', w:2, length:[1.8,2.1,2.5],   depth:[0.28,0.32,0.36],  curve:[0,0.01,0.03],      taper:[0.4,0.5,0.6],   hook:0.5, serrate:0.6},
  {name:'scavenging',      w:2, length:[1.3,1.5,1.7],   depth:[0.6,0.68,0.76],   curve:[0.04,0.06,0.09],   taper:[0.35,0.4,0.5],  hook:0.6, cere:0.4},
  {name:'raptorial',       w:3, length:[0.8,0.95,1.1],  depth:[0.55,0.65,0.75],  curve:[0.08,0.12,0.16],   taper:[0.4,0.5,0.6],   hook:0.45, cere:0.2},
];

function default_params(){
  return {
    body_length:180,
    body_height:58,
    body_skew:0.75,
    belly:1.1,
    rear_rise:0.15,
    tilt:0.45,
    plumage_type:0,
    plumage_scale:1,
    pattern_type:0,
    pattern_scale:1,
    wing_start:6,
    wing_y:0.45,
    wing_reach:0.25,
    wing_dark:0.5,
    primary_n:7,
    primary_step:0.04,
    secondary_n:7,
    secondary_reach:0.62,
    tertial_n:2,
    covert_n:8,
    covert_scale:1,
    has_wingbar:0,
    tail_type:0,
    tail_length:90,
    tail_angle:0.2,
    tail_spread:0.15,
    tail_n:5,
    tail_width:20,
    tail_tip:0.2,
    tail_dark:0.4,
    neck_back:5,
    neck_front:3,
    neck_length:0,
    neck_angle:0.3,
    head_size:34,
    head_angle:0.1,
    crown_flat:0.9,
    beak_type:0,
    beak_length:1,
    beak_depth:0.7,
    beak_curve:0.05,
    beak_hook:0,
    beak_taper:1,
    beak_dark:1,
    beak_serrate:0,
    beak_chisel:0,
    beak_kink:0,
    beak_cere:0,
    beak_upper_end:1,
    beak_open:0,
    pose:0,
    water_depth:0.38,
    eye_type:0,
    eye_size:0.2,
    has_eyering:0,
    crest_type:0,
    crest_length:1,
    cap_type:0,
    has_eyestripe:0,
    has_malar:0,
    has_bib:0,
    forehead:0.12,
    nape:0.06,
    cheek:0.06,
    crown_pos:0,
    leg_type:0,
    leg_length:0.4,
    leg_width:1,
    leg_pos:15,
    foot_dx:0,
    toe_length:1,
    perch_type:0,
    perch_size:1,
    perch_slope:0,
  }
}

function choice(opts,percs){
  if (!percs){
    percs = opts.map(x=>1);
  }
  let s = 0;
  for (let i = 0; i < percs.length; i++){
    s += percs[i];
  }
  let r = rand()*s;
  s = 0;
  for (let i = 0; i < percs.length; i++){
    s += percs[i];
    if (r <= s){
      return opts[i];
    }
  }
}

function rndtri(a,b,c){
  let s0 = (b-a)/2;
  let s1 = (c-b)/2;
  let s = s0 + s1;
  let r = rand()*s;
  if (r < s0){
    //d * d/(b-a) / 2 = r;
    let d = Math.sqrt(2*r*(b-a));
    return a + d;
  }
  //d * d/(c-b) / 2 = s-r;
  let d = Math.sqrt(2*(s-r)*(c-b));
  return c-d;
}

function generate_params(){

  let arg = default_params();
  arg.body_length = rndtri(150,180,230);
  arg.body_height = arg.body_length*rndtri(0.24,0.31,0.38);
  let H = arg.body_height;
  arg.body_skew = rndtri(0.55,0.75,0.95);
  arg.belly = rndtri(0.9,1.1,1.35);
  arg.rear_rise = rndtri(0,0.15,0.35);
  arg.plumage_type = choice([0,1,2,3]);
  arg.plumage_scale = rndtri(0.8,1,1.4);
  arg.pattern_type = choice([0,0,1,2,3]);
  arg.pattern_scale = rndtri(0.5,1,2);

  arg.leg_type = choice([0,1],[4,1]);
  if (arg.leg_type == 0){
    arg.leg_length = rndtri(0.15,0.35,0.7);
    arg.tilt = rndtri(0.15,0.5,0.85);
    arg.neck_length = rndtri(0,0.1,0.5)*H;
    arg.perch_type = choice([0,1],[4,1]);
  }else{
    arg.leg_length = rndtri(1.0,1.8,2.8);
    arg.tilt = rndtri(-0.05,0.15,0.35);
    arg.neck_length = rndtri(0.2,1,2.2)*H;
    arg.perch_type = choice([0,1],[1,3]);
  }
  arg.leg_width = rndtri(0.7,1,1.4);
  arg.leg_pos = ~~rndtri(13,15,18);
  arg.foot_dx = rndtri(-0.4,-0.1,0.2);
  arg.toe_length = rndtri(0.7,1,1.4);
  arg.perch_size = rndtri(0.6,1,1.6);
  arg.perch_slope = rndtri(-0.15,0,0.15);

  arg.wing_start = ~~rndtri(4,6,8);
  arg.wing_y = rndtri(0.35,0.45,0.6);
  arg.wing_reach = rndtri(-0.15,0.2,0.6);
  arg.wing_dark = rndtri(0,0.5,1);
  arg.primary_n = ~~rndtri(5,7,10);
  arg.primary_step = rndtri(0.025,0.04,0.07);
  arg.secondary_n = ~~rndtri(5,7,10);
  arg.secondary_reach = rndtri(0.5,0.62,0.75);
  arg.tertial_n = choice([1,2,3]);
  arg.covert_n = ~~rndtri(6,8,11);
  arg.covert_scale = rndtri(0.8,1,1.3);
  arg.has_wingbar = choice([0,0,1]);

  arg.tail_type = choice([0,1,2,3,4],[3,3,2,2,1]);
  arg.tail_length = arg.body_length*rndtri(0.25,0.5,1.1);
  if (arg.tail_type == 4){
    arg.tail_length = arg.body_length*rndtri(0.3,0.45,0.6);
  }
  arg.tail_angle = rndtri(-0.5,0.15,0.5);
  arg.tail_spread = rndtri(0.03,0.12,0.3);
  arg.tail_n = ~~rndtri(4,5,8);
  arg.tail_width = H*rndtri(0.28,0.36,0.5);
  arg.tail_tip = choice([0.1,0.3,0.8]);
  arg.tail_dark = rndtri(0,0.4,1);

  arg.head_size = H*rndtri(0.45,0.6,0.8);
  arg.head_angle = rndtri(-0.2,0.1,0.35);
  arg.crown_flat = rndtri(0.75,0.9,1);
  arg.neck_back = ~~rndtri(3,5,7);
  arg.neck_front = ~~rndtri(1,3,5);
  arg.neck_angle = rndtri(0,0.3,0.7);

  // long-legged waders pick from the long beaks of the water's edge; the flamingo beak only
  // goes to waders, so it stays rare and never ends up on a branch
  let wading = ['surface skimming','scything','probing','filter feeding','aerial fishing'];
  let guild = BEAKS.map((x,i)=>i).filter(i=>arg.leg_type ? wading.includes(BEAKS[i].name) : BEAKS[i].name != 'filter feeding');
  arg.beak_type = choice(guild,guild.map(i=>BEAKS[i].w*(arg.leg_type && BEAKS[i].w == 1 ? 1.2 : 1)));
  let bk = BEAKS[arg.beak_type];
  arg.beak_length = rndtri(...bk.length);
  arg.beak_depth = rndtri(...bk.depth);
  arg.beak_curve = rndtri(...bk.curve);
  arg.beak_taper = rndtri(...bk.taper);
  arg.beak_hook = bk.hook || 0;
  arg.beak_serrate = bk.serrate || 0;
  arg.beak_chisel = bk.chisel || 0;
  arg.beak_kink = bk.kink || 0;
  arg.beak_cere = bk.cere || 0;
  arg.beak_upper_end = bk.upper_end || 1;
  arg.beak_dark = choice([0,1,2]);

  arg.eye_type = choice([0,0,0,1]);
  arg.eye_size = rndtri(0.16,0.2,0.26);
  arg.has_eyering = choice([0,0,1]);

  arg.crest_type = choice([0,1,2],[6,2,1]);
  arg.crest_length = rndtri(0.7,1,1.4);
  arg.cap_type = choice([0,1,2],[3,2,1]);
  arg.has_eyestripe = choice([0,1]);
  arg.has_malar = choice([0,0,1]);
  arg.has_bib = choice([0,0,1]);

  arg.forehead = rndtri(0.05,0.14,0.25);
  arg.nape = rndtri(0,0.06,0.15);
  arg.cheek = rndtri(0,0.06,0.12);
  arg.crown_pos = rndtri(-0.25,0,0.2);

  // pose: 0 standing, 1 singing, 2 swimming. waders only stand
  if (arg.leg_type == 1){
    arg.pose = 0;
  }else{
    // singing is for short-billed songbirds
    let sing = arg.beak_length < 1.3 ? 4 : 0;
    arg.pose = choice([0,1,2],[5,sing,2]);
  }
  if (arg.pose == 1){
    arg.head_angle = rndtri(-0.75,-0.55,-0.35);
    arg.beak_open = rndtri(0.15,0.22,0.3);
    arg.tilt = Math.max(arg.tilt,rndtri(0.45,0.6,0.8));
    arg.cheek += 0.08;
    arg.tail_angle = rndtri(0.1,0.3,0.5);
  }else if (arg.pose == 2){
    arg.tilt = rndtri(-0.1,0,0.1);
    arg.tail_angle = rndtri(-0.5,-0.3,-0.1);
    arg.head_angle = rndtri(-0.1,0.05,0.2);
    arg.neck_angle = rndtri(0,0.2,0.4);
    arg.neck_length = H*rndtri(0.1,0.4,1);
    arg.water_depth = rndtri(0.3,0.38,0.45);
  }

  return arg;
}

function binomen(){
  let data =[["A","AB","AL","AN","AP","AR","AU","BA","BE","BO","BRA","CA","CAR","CENT","CHAE","CHAN","CHI","CHRO","CHRY","CO","CTE","CY","CYP","DE","E","EU","GA","GAS","GNA","GO","HE","HIP","HO","HY","LA","LAB","LE","LI","LO","LU","MAC","ME","MIC","MO","MU","MY","NA","NAN","NE","NO","O","ON","OP","OS","PA","PER","PHO","PI","PLA","PLEU","PO","PSEU","PTE","RA","RHI","RHOM","RU","SAL","SAR","SCA","SCOM","SE","SI","STE","TAU","TEL","THO","TRI","XE","XI"],
  ["BE","BI","BO","BU","CA","CAM","CAN","CE","CENT","CHA","CHEI","CHI","CHO","CHY","CI","CIRR","CO","DI","DO","DON","DOP","GA","GAS","GO","HI","HYN","LA","LAB","LE","LEOT","LI","LICH","LIS","LO","LOS","LU","LY","MA","ME","MI","MICH","MO","MU","NA","NE","NEC","NI","NO","NOCH","NOP","NOS","PA","PE","PEN","PHA","PHI","PHO","PHY","PHYO","PI","PIP","PIS","PO","POG","POPH","RA","RAE","RAM","REOCH","RI","RICH","RIP","RIS","RO","ROI","ROP","ROS","RY","RYN","SE","SO","TA","TE","TEL","THAL","THE","THO","THOP","THU","TI","TICH","TO","TOG","TOP","TOS","VA","XI","XO"],
  ["BIUS","BUS","CA","CHUS","CION","CON","CUS","DA","DES","DEUS","DON","DUS","GER","GON","GUS","HUS","LA","LEA","LIS","LIUS","LUS","MA","MIS","MUS","NA","NIA","NIO","NIUS","NOPS","NUS","PHEUS","PHIS","PIS","PUS","RA","RAS","RAX","RIA","RION","RIS","RUS","RYS","SA","SER","SIA","SIS","SUS","TER","TES","TEUS","THUS","THYS","TIA","TIS","TUS","TYS"],
  ["A","AE","AL","AN","AR","AT","AU","AUST","AY","BA","BAR","BE","BI","BO","CA","CAL","CAM","CAN","CAR","CAU","CE","CHI","CHRY","COR","CRY","CU","CYA","DA","DE","DEN","DI","DIA","DO","DOR","DU","E","FA","FAS","FES","FI","FLO","FOR","FRE","FUR","GLA","GO","HA","HE","HIP","HO","HYP","I","IM","IN","JA","LA","LAB","LE","LEU","LI","LO","LU","MA","MAC","MAR","ME","MO","MOO","MOR","NA","NE","NI","NIG","NO","O","OR","PA","PAL","PE","PEC","PHO","PLA","PLU","PO","PRO","PU","PUL","RA","RE","RHOM","RI","RO","ROST","RU","SA","SAL","SE","SO","SPI","SPLEN","STRIA","TAU","THO","TRI","TY","U","UN","VA","VI","VIT","VUL","WAL","XAN"],
  ["BA","BAR","BER","BI","BO","BOI","BU","CA","CAN","CAU","CE","CEL","CHA","CHEL","CHOP","CI","CIA","CIL","CIO","CO","COS","CU","DA","DE","DEL","DI","DIA","DO","FAS","FEL","FI","FOR","GA","GE","GI","HA","HYN","KE","LA","LAN","LE","LEA","LEU","LI","LIA","LO","LON","LOP","MA","ME","MEN","MI","MIE","MO","NA","NE","NEA","NEL","NEN","NI","NIF","NO","NOI","NOP","NU","PA","PE","PER","PHA","PHE","PI","PIN","PO","QUI","RA","RAC","RE","REN","RES","RI","RIA","RIEN","RIF","RO","ROR","ROS","ROST","RU","RYTH","SA","SE","SI","SO","SU","TA","TAE","TE","TER","THAL","THO","THU","TI","TIG","TO","TU","VA","VE","VES","VI","VIT","XEL","XI","ZO"],
  ["BEUS","CA","CENS","CEPS","CEUS","CHA","CHUS","CI","CUS","DA","DAX","DENS","DES","DI","DIS","DUS","FER","GA","GI","GUS","KEI","KI","LA","LAS","LI","LIS","LIUS","LOR","LUM","LUS","MA","MIS","MUS","NA","NEUS","NI","NII","NIS","NIUS","NUS","PIS","PUS","RA","RE","RI","RIAE","RIE","RII","RIO","RIS","RIX","RONS","RU","RUM","RUS","SA","SEUS","SI","SIS","SUS","TA","TEUS","THUS","TI","TIS","TOR","TUM","TUS","TZI","ZI"]]
  let freq =[[27,2,4,4,2,2,2,5,2,2,3,4,2,5,3,2,2,2,3,8,3,3,2,2,7,2,3,2,2,2,6,3,2,4,5,2,5,2,3,2,2,5,5,4,2,3,2,3,2,2,9,2,2,2,7,2,2,2,2,2,5,6,2,2,2,2,2,2,2,2,2,4,2,2,2,2,3,3,2,3],
  [2,2,3,3,5,2,11,6,4,2,7,2,4,4,3,3,5,4,9,2,2,4,5,13,3,3,12,3,3,2,8,3,4,15,6,2,3,10,3,3,2,2,2,8,7,3,4,20,2,2,3,4,3,2,10,2,6,2,2,5,2,2,13,2,2,14,3,2,2,9,4,2,5,42,2,4,2,6,3,3,11,2,19,2,3,2,5,3,2,4,2,27,2,2,2,2,2,2],
  [3,3,7,7,3,2,3,2,5,2,13,7,2,3,4,2,13,2,2,2,24,18,13,17,12,4,2,5,3,19,3,2,2,3,7,3,2,5,2,6,29,3,2,2,2,3,4,4,16,2,6,12,5,5,6,2],
  [23,3,11,6,6,3,8,2,2,2,3,3,9,3,8,2,2,3,2,2,2,2,6,2,2,3,4,3,4,2,2,2,2,2,2,15,2,4,2,2,2,2,2,2,2,2,2,5,3,2,2,3,2,2,2,7,2,2,3,3,4,4,13,7,3,10,2,2,2,5,2,3,6,4,14,2,3,2,5,2,2,3,2,3,2,2,2,3,5,2,2,3,2,3,5,2,5,2,3,3,3,3,3,7,2,3,2,4,3,2,2,2,2],
  [5,2,2,4,4,2,2,10,6,2,3,5,3,2,2,6,12,2,3,6,2,22,4,4,2,7,5,6,10,2,2,2,9,7,4,2,2,2,39,3,10,3,2,20,2,10,2,2,12,9,3,8,2,4,19,5,5,3,3,12,2,9,3,2,7,3,4,3,6,2,8,5,2,4,25,2,4,3,2,26,2,2,2,21,2,2,4,6,5,3,6,4,6,2,14,2,19,2,2,2,2,21,3,14,2,3,5,2,5,2,2,2,3],
  [2,7,4,3,5,2,5,2,13,6,2,2,6,8,2,4,3,4,2,5,2,5,11,3,7,19,2,2,2,11,10,4,6,12,3,15,4,6,2,18,3,3,11,4,14,2,2,3,2,13,2,3,2,4,21,7,2,10,8,13,31,2,5,5,2,2,10,68,2,3]]
    
  let name = choice(data[0],freq[0]);
  let n = ~~(rand()*3);
  for (let i = 0; i < n; i++){
    name += choice(data[1],freq[1]);
  }
  name += choice(data[2],freq[2]);
  name += ' ';
  name += choice(data[3],freq[3]);
  n = ~~(rand()*3);
  for (let i = 0; i < n; i++){
    name += choice(data[4],freq[4]);
  }
  name += choice(data[5],freq[5]);
  name = name.replace(/([A-Z])\1\1+/g,'$1$1');
  return name[0]+name.slice(1).toLowerCase();
}

let hershey_raw = {
"501":"  9I[RFJ[ RRFZ[ RMTWT",
"502":" 24G\\KFK[ RKFTFWGXHYJYLXNWOTP RKPTPWQXRYTYWXYWZT[K[",
"503":" 19H]ZKYIWGUFQFOGMILKKNKSLVMXOZQ[U[WZYXZV",
"504":" 16G\\KFK[ RKFRFUGWIXKYNYSXVWXUZR[K[",
"505":" 12H[LFL[ RLFYF RLPTP RL[Y[",
"506":"  9HZLFL[ RLFYF RLPTP",
"507":" 23H]ZKYIWGUFQFOGMILKKNKSLVMXOZQ[U[WZYXZVZS RUSZS",
"508":"  9G]KFK[ RYFY[ RKPYP",
"509":"  3NVRFR[",
"510":" 11JZVFVVUYTZR[P[NZMYLVLT",
"511":"  9G\\KFK[ RYFKT RPOY[",
"512":"  6HYLFL[ RL[X[",
"513":" 12F^JFJ[ RJFR[ RZFR[ RZFZ[",
"514":"  9G]KFK[ RKFY[ RYFY[",
"515":" 22G]PFNGLIKKJNJSKVLXNZP[T[VZXXYVZSZNYKXIVGTFPF",
"516":" 14G\\KFK[ RKFTFWGXHYJYMXOWPTQKQ",
"517":" 25G]PFNGLIKKJNJSKVLXNZP[T[VZXXYVZSZNYKXIVGTFPF RSWY]",
"518":" 17G\\KFK[ RKFTFWGXHYJYLXNWOTPKP RRPY[",
"519":" 21H\\YIWGTFPFMGKIKKLMMNOOUQWRXSYUYXWZT[P[MZKX",
"520":"  6JZRFR[ RKFYF",
"521":" 11G]KFKULXNZQ[S[VZXXYUYF",
"522":"  6I[JFR[ RZFR[",
"523":" 12F^HFM[ RRFM[ RRFW[ R\\FW[",
"524":"  6H\\KFY[ RYFK[",
"525":"  7I[JFRPR[ RZFRP",
"526":"  9H\\YFK[ RKFYF RK[Y[",
"601":" 18I\\XMX[ RXPVNTMQMONMPLSLUMXOZQ[T[VZXX",
"602":" 18H[LFL[ RLPNNPMSMUNWPXSXUWXUZS[P[NZLX",
"603":" 15I[XPVNTMQMONMPLSLUMXOZQ[T[VZXX",
"604":" 18I\\XFX[ RXPVNTMQMONMPLSLUMXOZQ[T[VZXX",
"605":" 18I[LSXSXQWOVNTMQMONMPLSLUMXOZQ[T[VZXX",
"606":"  9MYWFUFSGRJR[ ROMVM",
"607":" 23I\\XMX]W`VaTbQbOa RXPVNTMQMONMPLSLUMXOZQ[T[VZXX",
"608":" 11I\\MFM[ RMQPNRMUMWNXQX[",
"609":"  9NVQFRGSFREQF RRMR[",
"610":" 12MWRFSGTFSERF RSMS^RaPbNb",
"611":"  9IZMFM[ RWMMW RQSX[",
"612":"  3NVRFR[",
"613":" 19CaGMG[ RGQJNLMOMQNRQR[ RRQUNWMZM\\N]Q][",
"614":" 11I\\MMM[ RMQPNRMUMWNXQX[",
"615":" 18I\\QMONMPLSLUMXOZQ[T[VZXXYUYSXPVNTMQM",
"616":" 18H[LMLb RLPNNPMSMUNWPXSXUWXUZS[P[NZLX",
"617":" 18I\\XMXb RXPVNTMQMONMPLSLUMXOZQ[T[VZXX",
"618":"  9KXOMO[ ROSPPRNTMWM",
"619":" 18J[XPWNTMQMNNMPNRPSUTWUXWXXWZT[Q[NZMX",
"620":"  9MYRFRWSZU[W[ ROMVM",
"621":" 11I\\MMMWNZP[S[UZXW RXMX[",
"622":"  6JZLMR[ RXMR[",
"623":" 12G]JMN[ RRMN[ RRMV[ RZMV[",
"624":"  6J[MMX[ RXMM[",
"625":" 10JZLMR[ RXMR[P_NaLbKb",
"626":"  9J[XMM[ RMMXM RM[X[",
"710":"  6MWRYQZR[SZRY",
};

let hershey_cache = {};

function compile_hershey(i){
  if (hershey_cache[i]){
    return hershey_cache[i];
  }
  var entry = hershey_raw[i];
  if (entry == null){
    return;
  }
  var ordR = 82;
  var bound= entry.substring(3,5);
  var xmin = bound.charCodeAt(0)-ordR;
  var xmax = bound.charCodeAt(1)-ordR;
  var content = entry.substring(5);
  var polylines = [[]];
  var j  = 0;
  while (j < content.length){
    var digit = content.substring(j,j+2);
    if (digit == " R"){
      polylines.push([]);
    }else{
      var x  = digit.charCodeAt(0)-ordR;
      var y  = digit.charCodeAt(1)-ordR;
      polylines[polylines.length-1].push([x,y]);
    }
    j+=2;
  }
  let data = {
    xmin:xmin,
    xmax:xmax,
    polylines:polylines,
  };
  hershey_cache[i] = data;
  return data;
}

function put_text(txt){
  let base = 500;
  let x = 0;
  let o = [];
  for (let i = 0; i < txt.length; i++){
    let ord = txt.charCodeAt(i);
    let idx;
    if (65 <= ord && ord <= 90){
      idx = base+1+(ord-65);
    }else if (97 <= ord && ord <= 122){
      idx = base + 101+(ord-97);
    }else if (ord == 46){
      idx = 710;
    }else if (ord == 32){
      x += 10;
      continue;
    }else{
      continue;
    }
    let {xmin,xmax,polylines} = compile_hershey(idx);
    polylines = polylines.map(p=>trsl_poly(p,x-xmin,0));
    o.push(...polylines);
    x += (xmax-xmin);
  }
  return [x,o];
}

function str_to_seed(str){
  let n = 1;
  for (let i = 0; i < str.length; i++){
    let x = str.charCodeAt(i)+1;
    n ^= x << (7+(i%5));
    // if (i % 2){
      n ^=(n<<17);
      n ^=(n>>13);
      n ^=(n<<5);
    // }
    n = (n>>>0) % 4294967295;
  }
  return n;
}

function main(seed){
  if (seed === undefined){
    jsr = ~~(Math.random()*10000);
    let name = binomen();
    seed = name;
  }
  jsr = str_to_seed(seed);
  let drawing = bird(generate_params());
  return (cleanup(reframe(drawing,20,seed+'.')));
}


if (typeof module != "undefined"){
  module.exports = {main,generate_params,default_params,bird,reframe,cleanup,draw_svg,binomen,str_to_seed};
  if (require.main === module) {
    let seed = undefined;
    let format = 'svg';
    let speed = 0.005;
    for (let i = 2; i < process.argv.length; i++){
      let a = process.argv[i];
      if (a == '--seed'){
        seed = process.argv[i+1];
      }else if (a == '--format'){
        format = process.argv[i+1];
      }else if (a == '--speed'){
        if (process.argv[i+1] > 0)
          speed = speed / process.argv[i+1];
      }
    }
    let polylines = main(seed);
    if (format == 'svg'){
      console.log(draw_svg(polylines));
    }else if (format == 'json'){
      console.log(JSON.stringify(polylines));
    }else if (format == 'smil'){
      console.log(draw_svg_anim(polylines,speed));
    }else if (format == 'csv'){
      console.log(polylines.map(x=>x.flat().join(',')).join('\n'));
    }else if (format == 'ps'){
      console.log(draw_ps(polylines));
    }
  }
}
