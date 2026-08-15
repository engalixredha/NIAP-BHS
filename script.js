// Shared logo images live once in the closing slide's fixed-logos bar; every other
  // spot that needs the same artwork (intro screen, cover marquee) just points at it,
  // instead of re-embedding the same large base64 payload multiple times.
  const LOGO = {
    cscec: document.getElementById('logoFixedCscec').src,
    kiklop: document.getElementById('logoFixedKiklop').src,
    diam: document.getElementById('logoFixedDiam').src
  };
  document.querySelectorAll('img[data-logo-ref]').forEach(function(img){
    img.src = LOGO[img.getAttribute('data-logo-ref')];
  });

// The intro title-card is deliberately excluded here: it's a one-time animation,
  // not a slide, so it never counts toward the total and is never a navigable stop.
  const sections = Array.from(document.querySelectorAll('section')).filter(function(s){
    return s.id !== 's-intro';
  });
  const navdots = document.getElementById('navdots');

  let current = -1;
  let locked = false;
  let introDismissed = false;
  let introComplete = false; // only set true by the auto-advance timer below
  const LOCK_MS = 650;

  // Permanently retires the intro once its animation finishes.
  // Only callable once introComplete is true, so the intro can't be
  // skipped early via scroll/keyboard/touch/click — it must play out.
  // There's no cross-fade transition between the intro and slide 1:
  // the logos are simply hidden immediately, leaving the still-running
  // particle-network background visible on its own, and slide 1's
  // content then fades in on top of it via its normal section.active
  // transition — a hand-off, not a dissolve between two slides.
  function dismissIntro(){
    if(introDismissed || !introComplete) return;
    introDismissed = true;
    var introEl = document.getElementById('s-intro');
    if(introEl){
      // Hand the live particle-network canvas off to the cover slide before
      // the intro's logos disappear, instead of letting #s0 spin up its own
      // fresh copy. Same nodes, same motion, same background — it just
      // keeps going underneath the new content rather than restarting.
      var net = document.getElementById('introNet');
      var s0 = document.getElementById('s0');
      if(net && s0 && net.parentElement !== s0){
        s0.insertBefore(net, s0.firstChild);
      }
      introEl.classList.add('intro-exit');
      introEl.remove();
    }
  }

  sections.forEach((s,i)=>{
    const b = document.createElement('button');
    b.addEventListener('click',()=>goTo(i));
    navdots.appendChild(b);
  });
  const dots = Array.from(navdots.children);

  function render(prevIndex){
    if(current < 0) return;
    // Coming straight from the intro (prevIndex -1): slide 1 should just be
    // there the instant the logos vanish, on the same background, not fade
    // in over top of it. Temporarily kill the section's transition so this
    // one handoff snaps instead of animating; every later slide change still
    // uses the normal fade.
    const skipAnim = (prevIndex < 0);
    sections.forEach((s,i)=>{
      s.classList.remove('active','prev');
      if(i === current){
        if(skipAnim){
          s.style.transition = 'none';
          s.classList.add('active');
          void s.offsetWidth; // force reflow so the 'none' transition applies
          s.style.transition = '';
        }else{
          s.classList.add('active');
        }
      }
      else if(i === prevIndex && prevIndex < current) s.classList.add('prev');
    });
    dots.forEach((d,i)=>d.classList.toggle('active', i===current));
    if(navUp) navUp.disabled = (current <= 0);
    if(navDown) navDown.disabled = (current >= sections.length-1);
    // s0 and s13 have their own dark backgrounds — swap the side nav
    // (dots + up/down arrows) to white on those two so it stays visible.
    var sidenavEl = document.querySelector('.sidenav');
    if(sidenavEl){
      var onDarkSlide = sections[current] && (sections[current].id === 's0' || sections[current].id === 's13');
      sidenavEl.classList.toggle('on-dark', onDarkSlide);
    }
    try{
      history.replaceState(null,'','#'+sections[current].id);
    }catch(err){ /* replaceState unavailable in sandboxed preview — ignore */ }
    // Tell the 3D slide's iframe to pause its WebGL render loop whenever it's
    // not the slide on screen — otherwise it keeps rendering every frame in
    // the background after you've scrolled past it, which is what was making
    // the rest of the deck feel laggy.
    var hbs3dFrame = document.getElementById('hbs3dFrame');
    if(hbs3dFrame && hbs3dFrame.contentWindow){
      hbs3dFrame.contentWindow.postMessage({type:'hbs3d-visibility', active: current === 8}, '*');
    }
  }

  function goTo(index){
    if(current < 0 && !introComplete) return; // block advancing past the intro early
    dismissIntro();
    if(locked) return;
    index = Math.max(0, Math.min(sections.length-1, index));
    if(index === current) return;
    const prevIndex = current;
    current = index;
    locked = true;
    render(prevIndex);
    setTimeout(()=>{locked=false;}, LOCK_MS);
  }

  function next(){ goTo(current+1); }
  function prevSlide(){ goTo(current-1); }

  const navUp = document.getElementById('navUp');
  const navDown = document.getElementById('navDown');
  if(navUp) navUp.addEventListener('click', prevSlide);
  if(navDown) navDown.addEventListener('click', next);

  // initial paint
  render(-1);

  // Intro auto-advances to the first content slide once its animation finishes.
  setTimeout(function(){
    introComplete = true;
    dismissIntro();
    if(current < 0) goTo(0);
  }, 7200);

  // wheel — discrete slide jump, ignore trackpad micro-events while locked
  let wheelAccum = 0;
  window.addEventListener('wheel', (e)=>{
    e.preventDefault();
    if(locked) return;
    if(e.deltaY > 8) next();
    else if(e.deltaY < -8) prevSlide();
  }, {passive:false});

  // keyboard
  window.addEventListener('keydown', (e)=>{
    if(['ArrowDown','PageDown',' '].includes(e.key)){ e.preventDefault(); next(); }
    else if(['ArrowUp','PageUp'].includes(e.key)){ e.preventDefault(); prevSlide(); }
    else if(e.key === 'Home'){ goTo(0); }
    else if(e.key === 'End'){ goTo(sections.length-1); }
  });

  // touch swipe
  let touchStartY = null;
  window.addEventListener('touchstart', (e)=>{ touchStartY = e.touches[0].clientY; }, {passive:true});
  window.addEventListener('touchend', (e)=>{
    if(touchStartY === null) return;
    const dy = touchStartY - e.changedTouches[0].clientY;
    if(dy > 40) next();
    else if(dy < -40) prevSlide();
    touchStartY = null;
  }, {passive:true});

  // ---------------- cover/intro: animated blue particle network ----------------
  // Only introNet is created here — it's the one live canvas that gets handed
  // off from the intro to the cover slide in dismissIntro() above, so there's
  // never a second instance restarting the animation from scratch.
  ['introNet'].forEach(function(canvasId){
  (function(){
    const canvas = document.getElementById(canvasId);
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    let W, H, dpr;
    let nodes = [];
    let raf = null;

    function resize(){
      const rect = canvas.parentElement.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 3);
      W = rect.width; H = rect.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(dpr,0,0,dpr,0,0);
      const count = Math.max(28, Math.min(70, Math.round((W*H)/26000)));
      nodes = Array.from({length: count}, ()=>({
        x: Math.random()*W, y: Math.random()*H,
        vx: (Math.random()-0.5)*0.22, vy: (Math.random()-0.5)*0.22,
        r: Math.random()<0.12 ? (2.4+Math.random()*1.8) : (1+Math.random()*1.3)
      }));
    }

    function step(){
      ctx.clearRect(0,0,W,H);
      // drift + wrap
      nodes.forEach(n=>{
        n.x += n.vx; n.y += n.vy;
        if(n.x < -20) n.x = W+20; if(n.x > W+20) n.x = -20;
        if(n.y < -20) n.y = H+20; if(n.y > H+20) n.y = -20;
      });
      // connections
      const linkDist = Math.min(160, Math.max(90, W/9));
      for(let i=0;i<nodes.length;i++){
        for(let j=i+1;j<nodes.length;j++){
          const a = nodes[i], b = nodes[j];
          const dx = a.x-b.x, dy = a.y-b.y;
          const d = Math.sqrt(dx*dx+dy*dy);
          if(d < linkDist){
            const op = (1 - d/linkDist) * 0.5;
            ctx.strokeStyle = `rgba(90,150,255,${op})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
          }
        }
      }
      // nodes
      nodes.forEach(n=>{
        const isHub = n.r > 2.4;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI*2);
        ctx.fillStyle = isHub ? 'rgba(140,190,255,0.95)' : 'rgba(100,150,255,0.75)';
        ctx.fill();
        if(isHub){
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r+5, 0, Math.PI*2);
          ctx.strokeStyle = 'rgba(90,150,255,0.35)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      });
      raf = requestAnimationFrame(step);
    }

    resize();
    step();
    window.addEventListener('resize', resize);
  })();
  });

  // ---------------- cover: looping client-logo marquee ----------------
  (function(){
    const track = document.getElementById('coverMarqueeTrack');
    if(!track) return;
    const logos = [
      {src:LOGO.cscec, alt:'CSCEC'},
      {src:LOGO.kiklop, alt:'Kiklop'},
      {src:LOGO.diam, alt:'Diam'}
    ];
    function buildSet(){
      const frag = document.createDocumentFragment();
      logos.forEach(l=>{
        const wrap = document.createElement('div');
        wrap.className = 'item';
        const img = document.createElement('img');
        img.src = l.src; img.alt = l.alt;
        const dot = document.createElement('span');
        dot.className = 'dot';
        wrap.appendChild(img); wrap.appendChild(dot);
        frag.appendChild(wrap);
      });
      return frag;
    }
    // enough repeated copies to comfortably exceed any viewport width,
    // then translateX(-50%) on the whole (repeated) track loops seamlessly
    for(let i=0;i<8;i++) track.appendChild(buildSet());
  })();

(function(){
    function b64DecodeUnicode(str){
      return decodeURIComponent(atob(str).split('').map(function(c){
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
    }
    var frame = document.getElementById('hbs3dFrame');
    var dataEl = document.getElementById('hbs3dData');
    var loaded = false;
    function loadFrame(){
      if(loaded || !frame || !dataEl) return;
      loaded = true;
      frame.srcdoc = b64DecodeUnicode(dataEl.textContent.trim());
    }
    // Load once the 3D slide becomes active, so the deck's first paint stays fast.
    var s8 = document.getElementById('s8');
    if(s8){
      var mo = new MutationObserver(function(){
        if(s8.classList.contains('active')) loadFrame();
      });
      mo.observe(s8, {attributes:true, attributeFilter:['class']});
      if(s8.classList.contains('active')) loadFrame();
    }
  })();

(function(){
    // Original-document slide: the source PDF (via the flipbook viewer) is only
    // pointed at once this slide becomes active, keeping the deck's first paint fast.
    // The overlay spinner stays up until the viewer's own document has loaded; the
    // flipbook then tracks its own "Loading PDF… / Rendering pages… N%" progress
    // internally and clears itself once every page is fully rendered.
    var docFrame = document.getElementById('pdfDocFrame');
    var docLoading = document.getElementById('pdfDocLoading');
    var docDataEl = document.getElementById('pdfDocData');
    var docLoaded = false;
    function b64DecodeUnicodeDoc(str){
      return decodeURIComponent(atob(str).split('').map(function(c){
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
    }
    function loadDocFrame(){
      if(docLoaded || !docFrame || !docDataEl) return;
      docLoaded = true;
      docFrame.addEventListener('load', function(){
        if(docLoading){
          docLoading.style.opacity = '0';
          setTimeout(function(){ docLoading.style.display = 'none'; }, 350);
        }
      });
      docFrame.srcdoc = b64DecodeUnicodeDoc(docDataEl.textContent.trim());
    }
    var s12b = document.getElementById('s12b');
    if(s12b){
      var mo2 = new MutationObserver(function(){
        if(s12b.classList.contains('active')) loadDocFrame();
      });
      mo2.observe(s12b, {attributes:true, attributeFilter:['class']});
      if(s12b.classList.contains('active')) loadDocFrame();
    }
  })();
