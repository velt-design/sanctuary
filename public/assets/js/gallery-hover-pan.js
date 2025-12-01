/*! Sanctuary Gallery hover-pan */
/* eslint-disable @typescript-eslint/no-unused-vars */
(function(){
  function clamp(v,a,b){ return Math.min(b, Math.max(a,v)); }
  function smoothstep(a,b,x){ const t = clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); }
  function placeholder(w,h,label){
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>
      <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0%' stop-color='#dfe2e6'/><stop offset='100%' stop-color='#eef1f4'/>
      </linearGradient></defs>
      <rect width='100%' height='100%' fill='url(#g)'/>
      <text x='50%' y='50%' alignment-baseline='middle' text-anchor='middle'
        font-family='-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif'
        font-size='22' fill='#7a7f87' letter-spacing='1'>${label}</text>
    </svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  window.initHoverPanGallery = function(viewport, opts){
    const doc = viewport.ownerDocument, root = doc.documentElement;
    const cfg = Object.assign({
      totalCols: 10, totalRows: 10,
      allowedCols: [2,3,4,5,6],
      allowedRows: [2,3,4,5,6],
      deadZone: 0.2875,
      hoverDelayMs: 300,
      rampMs: 900,
      maxSpeed: 1600 * 0.75,
      reduceMotionFactor: 0.5,
      tileMinPx: 60,
      headerSelector: 'header'
    }, opts || {});
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) cfg.maxSpeed *= cfg.reduceMotionFactor;

    const pan = viewport.querySelector('#pan');
    const grid = viewport.querySelector('#grid');
    const headerEl = cfg.headerSelector ? doc.querySelector(cfg.headerSelector) : null;

    let tile=280, gap=12, visibleCols=3, visibleRows=3;
    // Smooth-zoom targets and last applied values
    let targetTile = tile, targetGap = gap;
    let appliedTile = tile, appliedGap = gap;
    let panX=0, panY=0, minPanX=0, minPanY=0, maxPanX=0, maxPanY=0;
    let mouse={x:0,y:0,inside:false}, last=performance.now();
    // Activation state machine
    let hoverActive=false, activationTO=null, hoverActiveSince=null;
    // Drag state
    let panning=false, psx=0, psy=0, pspx=0, pspy=0, dragMoved=false;
    const DRAG_THRESHOLD = 3;

    function setHeaderH(){
      const h = headerEl ? (headerEl.offsetHeight||0) : 0;
      root.style.setProperty('--headerH', h + 'px');
    }

    let firstLayout = true;
    function computeLayout(){
      const vw = Math.max(320, doc.defaultView.innerWidth || doc.documentElement.clientWidth || 0);
      const vh = Math.max(320, doc.defaultView.innerHeight || doc.documentElement.clientHeight || 0);
      const headerH = headerEl ? (headerEl.offsetHeight||0) : 0;
      let best=null;
      for(const g of [8,12,16]){
        for(const cols of cfg.allowedCols){
          for(const rows of cfg.allowedRows){
            const availW = vw - 2*g - (cols-1)*g;
            const availH = (vh - headerH) - 2*g - (rows-1)*g;
            const t = Math.min(Math.floor(availW/cols), Math.floor(availH/rows));
            if (t <= cfg.tileMinPx) continue;
            if (!best || t > best.tile) best = {tile:t, gap:g, cols, rows};
          }
        }
      }
      if (!best){
        const tSafe = Math.max(140, Math.min(360, Math.floor(Math.min(vw, vh - headerH) / 3)));
        best = {tile:tSafe, gap:12, cols:3, rows:3};
      }
      // Optional external zoom factor (1 = default) – allow smaller min for deeper zoom-out
      const zoom = Math.max(0.4, Number(doc.defaultView.SANCTUARY_GALLERY_ZOOM || 1));
      targetTile = Math.max(cfg.tileMinPx, best.tile * zoom);
      targetGap  = Math.max(6,               best.gap  * zoom);
      visibleCols=best.cols; visibleRows=best.rows;
      // On very first compute, apply immediately so layout is correct before the first frame
      if (firstLayout){
        tile = appliedTile = targetTile;
        gap  = appliedGap  = targetGap;
        firstLayout = false;
      }
      root.style.setProperty('--tile', tile.toFixed(2) + 'px');
      root.style.setProperty('--gap',  gap.toFixed(2)  + 'px');
    }

    function buildGrid(){
      grid.innerHTML = '';
      const imgs = doc.defaultView.SANCTUARY_GALLERY_IMAGES;
      let i=0;
      for(let r=0; r<cfg.totalRows; r++){
        for(let c=0; c<cfg.totalCols; c++){
          const cell = doc.createElement('div'); cell.className='cell';
          const img  = doc.createElement('img');
          img.src = (imgs && imgs[i]) ? imgs[i] : placeholder(tile, tile, `R${r+1} • C${c+1}`);
          img.alt = `Project ${i+1}`; img.decoding='async'; img.loading='lazy'; img.draggable=false;
          const ph = doc.createElement('div'); ph.className='ph'; ph.textContent=`R${r+1} • C${c+1}`;
          cell.appendChild(img); cell.appendChild(ph); grid.appendChild(cell);
          i++;
        }
      }
      grid.addEventListener('dragstart', e=>e.preventDefault(), {once:true});
    }

    function measure(){
      pan.style.transform='translate3d(0,0,0)';
      const vr = viewport.getBoundingClientRect();
      const step = tile + gap, pad = gap;
      const vpCx = vr.width/2, vpCy = vr.height/2;
      const leftTileCenterX  = pad + (tile/2);
      const rightTileCenterX = pad + (cfg.totalCols-1)*step + (tile/2);
      const topTileCenterY   = pad + (tile/2);
      const bottomTileCenterY= pad + (cfg.totalRows-1)*step + (tile/2);
      maxPanX = vpCx - leftTileCenterX;
      minPanX = vpCx - rightTileCenterX;
      maxPanY = vpCy - topTileCenterY;
      minPanY = vpCy - bottomTileCenterY;
      setPan(panX, panY);
    }

    function setPan(x,y){
      panX = Math.min(maxPanX, Math.max(minPanX, x));
      panY = Math.min(maxPanY, Math.max(minPanY, y));
      pan.style.transform = `translate3d(${panX}px, ${panY}px, 0)`;
    }

    function cancelActivation(){
      if (activationTO){ clearTimeout(activationTO); activationTO=null; }
      hoverActive=false; hoverActiveSince=null;
    }
    function scheduleActivation(){
      cancelActivation();
      activationTO = setTimeout(()=>{ hoverActive=true; hoverActiveSince=performance.now(); }, cfg.hoverDelayMs);
    }

    // Pointer + hover
    viewport.addEventListener('pointerenter', ()=>{ mouse.inside=true; scheduleActivation(); });
    viewport.addEventListener('mouseenter',    ()=>{ mouse.inside=true; scheduleActivation(); });
    viewport.addEventListener('pointerleave',  ()=>{ mouse.inside=false; cancelActivation(); });
    viewport.addEventListener('pointermove', e=>{ mouse.x=e.clientX; mouse.y=e.clientY; }, {passive:true});

    // Wheel pan with delay reset after idle
    let wheelIdleTO=null;
    viewport.addEventListener('wheel', e=>{
      const vr = viewport.getBoundingClientRect();
      const scale = e.deltaMode===1 ? 16 : (e.deltaMode===2 ? vr.height : 1);
      setPan(panX - e.deltaX*scale, panY - e.deltaY*scale);
      cancelActivation();
      clearTimeout(wheelIdleTO);
      wheelIdleTO = setTimeout(scheduleActivation, 120);
      e.preventDefault();
    }, {passive:false});

    // Grab-to-pan with click suppression
    viewport.addEventListener('pointerdown', e=>{
      if (e.button!==0) return;
      panning=true; dragMoved=false; viewport.classList.add('dragging');
      psx=e.clientX; psy=e.clientY; pspx=panX; pspy=panY;
      cancelActivation();
      try{ viewport.setPointerCapture(e.pointerId); }catch{}
      e.preventDefault();
    });
    viewport.addEventListener('pointermove', e=>{
      if(!panning) return;
      const dx=e.clientX-psx, dy=e.clientY-psy;
      if(!dragMoved && (Math.abs(dx)>DRAG_THRESHOLD || Math.abs(dy)>DRAG_THRESHOLD)) dragMoved=true;
      setPan(pspx+dx, pspy+dy);
    });
    function endPan(e){
      if(!panning) return;
      panning=false; viewport.classList.remove('dragging');
      try{ viewport.releasePointerCapture(e.pointerId); }catch{}
      scheduleActivation();
    }
    viewport.addEventListener('pointerup', endPan);
    viewport.addEventListener('pointercancel', endPan);
    viewport.addEventListener('pointerleave', endPan);

    viewport.addEventListener('click', e=>{
      if (dragMoved){ e.stopPropagation(); e.preventDefault(); dragMoved=false; }
    }, true);

    // Keyboard nudge
    viewport.addEventListener('keydown', e=>{
      const step = tile + gap; let handled=true, tx=panX, ty=panY;
      switch(e.key){
        case 'ArrowLeft':  tx = panX + step; break;
        case 'ArrowRight': tx = panX - step; break;
        case 'ArrowUp':    ty = panY + step; break;
        case 'ArrowDown':  ty = panY - step; break;
        default: handled=false;
      }
      if (handled){ e.preventDefault(); setPan(tx,ty); }
    });

    // RAF loop
    function tick(t){
      const dt = (t - last)/1000; last=t;
      // Smoothly ease current tile/gap toward target values
      const tau = 0.22; // time constant in seconds
      const k = 1 - Math.exp(-dt / Math.max(0.001, tau));
      const nextTile = tile + (targetTile - tile) * k;
      const nextGap  = gap  + (targetGap  - gap)  * k;
      if (Math.abs(nextTile - tile) > 0.02 || Math.abs(nextGap - gap) > 0.02){
        tile = nextTile; gap = nextGap;
        // Update CSS vars every frame for visual smoothness
        root.style.setProperty('--tile', tile.toFixed(2) + 'px');
        root.style.setProperty('--gap',  gap.toFixed(2)  + 'px');
        // Recalculate bounds occasionally (when change is perceptible)
        if (Math.abs(tile - appliedTile) > 1 || Math.abs(gap - appliedGap) > 1){
          appliedTile = tile; appliedGap = gap;
          measure();
        }
      }
      if (mouse.inside && hoverActive && !panning){
        const r = viewport.getBoundingClientRect();
        const cx = r.left + r.width/2, cy = r.top + r.height/2;
        const hx = r.width/2, hy = r.height/2;
        const nx = (mouse.x - cx) / (hx || 1);
        const ny = (mouse.y - cy) / (hy || 1);
        const norm = Math.hypot(nx, ny);
        const rad  = Math.min(1, norm);
        if (rad > cfg.deadZone){
          const ux = nx / (norm || 1);
          const uy = ny / (norm || 1);
          const positionFactor = smoothstep(cfg.deadZone, 1, rad);
          const rampT = clamp((performance.now() - (hoverActiveSince||performance.now()))/cfg.rampMs, 0, 1);
          const ramp = rampT * rampT; // ease-in
          const speed = positionFactor * cfg.maxSpeed * ramp;
          setPan(panX + (-ux * speed * dt), panY + (-uy * speed * dt));
        }
      }
      doc.defaultView.requestAnimationFrame(tick);
    }

    function init(){
      setHeaderH(); computeLayout(); buildGrid();
      doc.defaultView.requestAnimationFrame(()=>{ measure(); setPan(0,0); });
      doc.defaultView.requestAnimationFrame(tick);
      // inactive until pointer enters
      cancelActivation();
      let to=null;
      doc.defaultView.addEventListener('resize', ()=>{
        clearTimeout(to); to=setTimeout(()=>{ setHeaderH(); computeLayout(); buildGrid(); doc.defaultView.requestAnimationFrame(measure); }, 60);
      });
      // Smooth zoom updates from app: recompute targets only
      doc.defaultView.addEventListener('sp-zoom', ()=>{
        computeLayout();
      });
    }
    init();
  };
})();
