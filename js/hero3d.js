/* The Specialist – úvodní vizuál „Pět oblastí“.
   Základ: statické SVG + tlačítka (funguje vždy, i bez WebGL a na mobilu).
   Vylepšení: na desktopu s myší se nad SVG vykreslí 3D scéna ve WebGL.
   Pokud WebGL selže, zůstane statická varianta – obsah je dostupný vždy. */
(function () {
  'use strict';
  var host = document.querySelector('.experience');
  if (!host) return;
  var buttons = [].slice.call(host.querySelectorAll('[data-pillar]'));
  var pillars = [].slice.call(host.querySelectorAll('.scene-static .pillar'));
  var title = document.getElementById('pillar-title');
  var desc = document.getElementById('pillar-description');
  var link = document.getElementById('pillar-link');
  var selected = 0;
  var renderer = null;

  function select(i, fromUser) {
    selected = i;
    buttons.forEach(function (b, j) { b.setAttribute('aria-pressed', String(i === j)); });
    pillars.forEach(function (p, j) { p.classList.toggle('is-active', i === j); });
    var b = buttons[i];
    title.textContent = b.getAttribute('data-title');
    desc.textContent = b.getAttribute('data-text');
    link.href = b.getAttribute('data-href');
    link.setAttribute('aria-label', link.textContent.replace(/\s*↗\s*$/, '') + ': ' + b.getAttribute('data-label'));
    link.setAttribute('data-service', b.getAttribute('data-service'));
    if (fromUser && window.TSTrack) window.TSTrack('hero_area_select', { area_index: i + 1 });
    draw();
  }
  buttons.forEach(function (b, i) {
    b.addEventListener('click', function () { select(i, true); });
    b.addEventListener('keydown', function (e) {
      var keys = { ArrowRight: 1, ArrowLeft: -1, Home: 'h', End: 'e' };
      if (!(e.key in keys)) return;
      e.preventDefault();
      var n = e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : (i + keys[e.key] + buttons.length) % buttons.length;
      buttons[n].focus();
      select(n, true);
    });
  });
  // klik na statický pilíř
  pillars.forEach(function (p, i) { p.style.cursor = 'pointer'; p.addEventListener('click', function () { select(i, true); }); });

  /* ---------------- WebGL vylepšení ---------------- */
  var canvas = document.getElementById('business-scene');
  var desktop = matchMedia('(min-width: 721px) and (hover: hover) and (pointer: fine)');
  var yaw = 0.32, pitch = 0, yawT = 0.32, pitchT = 0, raf = 0;

  function draw() { if (renderer && !raf) raf = requestAnimationFrame(frame); }
  function frame() {
    raf = 0;
    if (!renderer) return;
    yaw += (yawT - yaw) * 0.12;
    pitch += (pitchT - pitch) * 0.12;
    renderer.draw(yaw, pitch, selected);
    if (Math.abs(yawT - yaw) > 0.001 || Math.abs(pitchT - pitch) > 0.001) raf = requestAnimationFrame(frame);
  }

  function initGL() {
    if (renderer || !canvas || !desktop.matches) return;
    try {
      var gl = canvas.getContext('webgl', { alpha: true, antialias: true, powerPreference: 'low-power' });
      if (!gl) return;
      renderer = createRenderer(gl, canvas);
      draw();
      // scéna je připravená až po prvním úspěšném vykreslení
      requestAnimationFrame(function () { if (renderer) host.classList.add('scene-ready'); });
    } catch (err) {
      renderer = null;
      host.classList.remove('scene-ready');
    }
  }
  if (canvas) {
    canvas.addEventListener('pointermove', function (e) {
      var r = canvas.getBoundingClientRect();
      yawT = 0.32 + ((e.clientX - r.left - r.width / 2) / r.width) * 0.45;
      pitchT = ((e.clientY - r.top - r.height / 2) / r.height) * 0.6;
      draw();
    });
    canvas.addEventListener('pointerleave', function () { yawT = 0.32; pitchT = 0; draw(); });
    canvas.addEventListener('click', function (e) {
      if (!renderer) return;
      var r = canvas.getBoundingClientRect();
      var i = renderer.pick(((e.clientX - r.left) / r.width) * 2 - 1, 1 - ((e.clientY - r.top) / r.height) * 2);
      if (i >= 0) select(i, true);
    });
    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); renderer = null; host.classList.remove('scene-ready'); });
    canvas.addEventListener('webglcontextrestored', initGL);
    if ('ResizeObserver' in window) new ResizeObserver(draw).observe(canvas);
    desktop.addEventListener && desktop.addEventListener('change', function () {
      if (!desktop.matches) { renderer = null; host.classList.remove('scene-ready'); } else initGL();
    });
  }
  // WebGL až když je prohlížeč volný – nezdržuje načtení stránky
  (window.requestIdleCallback || function (f) { setTimeout(f, 200); })(initGL);

  /* ---------------- minimalistický WebGL renderer ---------------- */
  function createRenderer(gl, canvas) {
    function identity() { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }
    function multiply(a, b) { var o = new Array(16).fill(0); for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) for (var k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; }
    function norm(v) { var n = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / n, v[1] / n, v[2] / n]; }
    function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
    function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
    function lookAt(eye, t) { var z = norm([eye[0] - t[0], eye[1] - t[1], eye[2] - t[2]]), x = norm(cross([0, 1, 0], z)), y = cross(z, x); return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]; }
    function persp(f, a, n, fa) { var t = 1 / Math.tan(f / 2), nf = 1 / (n - fa); return [t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) * nf, -1, 0, 0, 2 * fa * n * nf, 0]; }
    function model(x, y, z, sx, sy, sz) { var m = identity(); m[0] = sx; m[5] = sy; m[10] = sz; m[12] = x; m[13] = y; m[14] = z; return m; }
    function project(m, p) { var v = [p[0], p[1], p[2], 1], o = [0, 0, 0, 0]; for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) o[r] += m[c * 4 + r] * v[c]; return [o[0] / o[3], o[1] / o[3]]; }
    function cube() {
      var d = [];
      function face(a, b, c, e, n) { [a, b, c, a, c, e].forEach(function (v) { d.push(v[0], v[1], v[2], n[0], n[1], n[2]); }); }
      face([-.5, -.5, .5], [.5, -.5, .5], [.5, .5, .5], [-.5, .5, .5], [0, 0, 1]);
      face([.5, -.5, -.5], [-.5, -.5, -.5], [-.5, .5, -.5], [.5, .5, -.5], [0, 0, -1]);
      face([.5, -.5, .5], [.5, -.5, -.5], [.5, .5, -.5], [.5, .5, .5], [1, 0, 0]);
      face([-.5, -.5, -.5], [-.5, -.5, .5], [-.5, .5, .5], [-.5, .5, -.5], [-1, 0, 0]);
      face([-.5, .5, .5], [.5, .5, .5], [.5, .5, -.5], [-.5, .5, -.5], [0, 1, 0]);
      face([-.5, -.5, -.5], [.5, -.5, -.5], [.5, -.5, .5], [-.5, -.5, .5], [0, -1, 0]);
      return d;
    }
    function ring() {
      var d = [];
      for (var i = 0; i < 96; i++) {
        var a = (i * Math.PI * 2) / 96, b = ((i + 1) * Math.PI * 2) / 96;
        var p = function (r, t) { return [r * Math.cos(t), 0, r * Math.sin(t), 0, 1, 0]; };
        [p(.52, a), p(.58, a), p(.58, b), p(.52, a), p(.58, b), p(.52, b)].forEach(function (v) { d.push.apply(d, v); });
      }
      return d;
    }
    function compile(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s)); return s; }
    var prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, 'attribute vec3 position;attribute vec3 normal;uniform mat4 vp;uniform mat4 model;varying vec3 n;varying vec3 world;void main(){vec4 w=model*vec4(position,1.0);world=w.xyz;n=normal;gl_Position=vp*w;}'));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, 'precision mediump float;varying vec3 n;varying vec3 world;uniform vec3 color;uniform vec3 eye;void main(){vec3 N=normalize(n);vec3 L=normalize(vec3(-3.0,6.0,4.0));vec3 V=normalize(eye-world);float light=max(dot(N,L),0.0);float spec=pow(max(dot(N,normalize(L+V)),0.0),44.0);float rim=pow(1.0-max(dot(N,V),0.0),3.0);vec3 c=color*(0.40+0.60*light)+vec3(1.0,0.89,0.63)*spec*0.35+vec3(0.12,0.18,0.10)*rim;gl_FragColor=vec4(c,1.0);}'));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw Error('WebGL link failed');
    gl.useProgram(prog);
    var loc = { p: gl.getAttribLocation(prog, 'position'), n: gl.getAttribLocation(prog, 'normal'), vp: gl.getUniformLocation(prog, 'vp'), model: gl.getUniformLocation(prog, 'model'), color: gl.getUniformLocation(prog, 'color'), eye: gl.getUniformLocation(prog, 'eye') };
    function buf(v) { var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW); return { b: b, count: v.length / 6 }; }
    var box = buf(cube()), halo = buf(ring());
    gl.enable(gl.DEPTH_TEST);
    gl.enableVertexAttribArray(loc.p);
    gl.enableVertexAttribArray(loc.n);
    gl.clearColor(0, 0, 0, 0);
    function mesh(g, m, c) { gl.bindBuffer(gl.ARRAY_BUFFER, g.b); gl.vertexAttribPointer(loc.p, 3, gl.FLOAT, false, 24, 0); gl.vertexAttribPointer(loc.n, 3, gl.FLOAT, false, 24, 12); gl.uniformMatrix4fv(loc.model, false, new Float32Array(m)); gl.uniform3fv(loc.color, c); gl.drawArrays(gl.TRIANGLES, 0, g.count); }
    var centers = [];
    return {
      draw: function (angle, tilt, index) {
        var r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        var w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        gl.viewport(0, 0, w, h);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        var eye = [Math.sin(angle) * 6.6, 3.7 + tilt, Math.cos(angle) * 6.6];
        var vp = multiply(persp(Math.PI / 4.4, w / h, 0.1, 40), lookAt(eye, [0, 0.55, 0]));
        gl.uniformMatrix4fv(loc.vp, false, new Float32Array(vp));
        gl.uniform3fv(loc.eye, eye);
        mesh(box, model(0, -0.2, 0, 6.5, 0.16, 2.1), [0.08, 0.19, 0.13]);
        mesh(box, model(0, -0.105, 0, 6.25, 0.025, 1.95), [0.32, 0.37, 0.22]);
        centers = [];
        for (var i = 0; i < 5; i++) {
          var x = (i - 2) * 1.18, z = Math.abs(i - 2) * 0.13, act = i === index;
          var hgt = act ? 1.75 : 1.35, gold = act ? [0.84, 0.67, 0.34] : [0.53, 0.49, 0.29], bodyC = act ? [0.28, 0.46, 0.29] : [0.10, 0.28, 0.18];
          mesh(box, model(x, -0.01, z, 0.99, 0.15, 0.99), [0.05, 0.13, 0.09]);
          mesh(box, model(x, hgt / 2 + 0.055, z, 0.79, hgt, 0.79), bodyC);
          mesh(box, model(x, hgt + 0.075, z, 0.81, 0.065, 0.81), gold);
          mesh(box, model(x, hgt * 0.48, z + 0.401, 0.033, hgt * 0.73, 0.015), gold);
          if (act) mesh(halo, model(x, hgt + 0.21, z, 1, 1, 1), [0.94, 0.77, 0.44]);
          centers.push(project(vp, [x, hgt * 0.65, z]));
        }
      },
      pick: function (x, y) { var best = -1, dist = 0.25; centers.forEach(function (p, i) { var d = Math.hypot(p[0] - x, p[1] - y); if (d < dist) { dist = d; best = i; } }); return best; }
    };
  }
})();
