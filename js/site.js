(function(){
  var nav=document.getElementById('nav'),burger=document.querySelector('.burger'),sub=document.querySelector('.has-sub'),btn=sub&&sub.querySelector('button');
  function setSub(o){if(sub){sub.classList.toggle('open',o);btn.setAttribute('aria-expanded',o)}}
  if(burger)burger.addEventListener('click',function(){var o=nav.classList.toggle('open');burger.setAttribute('aria-expanded',o);document.body.style.overflow=o?'hidden':''});
  if(btn)btn.addEventListener('click',function(e){e.stopPropagation();setSub(!sub.classList.contains('open'))});
  document.addEventListener('click',function(e){if(sub&&!sub.contains(e.target))setSub(false)});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')setSub(false)});

  // auto-advancing widgets; pause on hover, stay still for reduced motion
  var still=matchMedia('(prefers-reduced-motion:reduce)').matches;
  function cycle(root,n,show,ms){
    var i=0,t;
    function play(){clearInterval(t);if(!still)t=setInterval(function(){go(i+1)},ms)}
    function go(k){i=(k+n)%n;show(i)}
    root.addEventListener('mouseenter',function(){clearInterval(t)});
    root.addEventListener('mouseleave',play);
    go(0);play();
    return function(k){go(k);play()};
  }
  function onPick(els,fn){els.forEach(function(el,j){
    el.addEventListener('click',function(){fn(j)});
    el.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();fn(j)}});
  })}

  // home process: active step expands, the progress bar drives the timing
  document.querySelectorAll('.proc').forEach(function(p){
    var li=p.querySelectorAll('.proc-row li'),img=p.querySelectorAll('.proc-img img'),bar=p.querySelector('.proc-bar span'),n=li.length,i=0;
    function show(k){
      i=(k+n)%n;
      li.forEach(function(el,j){var o=(j-i+n)%n;el.classList.toggle('on',!o);el.style.order=o;el.hidden=o>3});
      img.forEach(function(el,j){el.hidden=j!==i});
      bar.style.animation='none';void bar.offsetWidth;bar.style.animation='';
    }
    onPick(li,show);
    bar.addEventListener('animationend',function(){show(i+1)});
    show(0);
  });

  // testimonials: quote fades, logo column centres the active logo
  document.querySelectorAll('.tst').forEach(function(w){
    var q=w.querySelectorAll('figure'),logos=w.querySelectorAll('.tst-logos span'),track=w.querySelector('.tst-logos>div'),dots=w.querySelector('.tst-dots'),b=[];
    q.forEach(function(_,j){var d=document.createElement('button');d.type='button';d.setAttribute('aria-label',j+1);dots.appendChild(d);b.push(d)});
    var go=cycle(w,q.length,function(i){
      [q,logos,b].forEach(function(set){set.forEach(function(el,j){el.classList.toggle('on',j===i)})});
      var l=logos[i];track.style.transform='translateY('+(track.parentNode.clientHeight/2-l.offsetTop-l.offsetHeight/2)+'px)';
    },6000);
    b.forEach(function(d,j){d.addEventListener('click',function(){go(j)})});
  });

  // accordions: one item open per group, height animated on open/close
  document.querySelectorAll('.acc').forEach(function(acc){
    var items=acc.querySelectorAll(':scope>details'),seen=false;
    function slide(d,open){
      var from=d.offsetHeight;
      if(d._a)d._a.cancel();
      d.open=true;d.classList.toggle('shut',!open);
      var to=open?d.offsetHeight:d.querySelector('summary').offsetHeight+d.offsetHeight-d.clientHeight;
      if(still||from===to){d.open=open;return}
      d.style.overflow='hidden';
      d._a=d.animate({height:[from+'px',to+'px']},{duration:350,easing:'cubic-bezier(.4,0,.2,1)'});
      d._a.onfinish=function(){d._a=null;d.open=open;d.style.overflow=''};
    }
    items.forEach(function(d){
      if(d.open){if(seen)d.open=false;seen=true}
      d._on=d.open;
      d.querySelector('summary').addEventListener('click',function(e){
        e.preventDefault();
        if(!d.querySelector(':scope>:not(summary)'))return;
        d._on=!d._on;slide(d,d._on);
        if(d._on)items.forEach(function(o){if(o!==d&&o._on){o._on=false;slide(o,false)}});
      });
    });
  });

  // decorative curves: drawn while the section scrolls from viewport bottom to centre
  var curves={
    ov:[1440,425,'bottom:0','M-216.7 208.2C-141.7-18.8 161.2-60.8 295.3 137.1L398.4 289.4C480.4 410.6 632.4 463.2 771.8 418.8L1113.1 310.1C1242.1 269 1381.5 330.9 1437.5 454.2'],
    val:[1438,355,'top:0','M1472.8 146.3C1397.7 373.3 1094.8 415.4 960.7 217.4L857.6 65.1C775.6-56 623.6-108.7 484.2-64.3L143 44.5C13.9 85.6-125.5 23.6-181.5-99.7'],
    strip:[1440,213,'top:-2px','M1429.7-113.8C1375.5 44.4 1168.8 82.2 1061.8-46.3 1005.1-114.4 912.4-140.8 828.4-112.6L-58.1 184.7C-128.5 208.4-204.9 207.5-274.8 182.4L-306.7 170.9'],
    hero:[1397,331,'top:0','M1393.1 321.2L1012 168.1C945.6 141.5 871.3 141.9 805.2 169.3 710.1 208.8 600.8 191.5 522.5 124.5L482.1 89.8C407.4 25.9 308.2-1.4 211.3 15.3L-41 58.9'],
    trust:[1437,547,'top:69px','M-50.3 545.2L-20.2 367.7C23.9 107.7 347.5 11.8 526.2 205.8 643.9 333.5 842.4 342.9 971.6 226.8L1137.8 77.6C1228.4-3.7 1363.2-12 1463.1 57.7'],
    team:[1440,782,'top:0','M1708 1169.2L1774.6 959.2C1857.4 697.9 1603.9 455.3 1346.5 549.7L1310.4 562.9C1140.8 625 952.8 539.3 888.5 370.5L802.3 144.2C752 12.3 623.5-73 482.4-68.1L-9.5-51'],
    about:[1365,494,'bottom:0','M-216.7 277.3L-143.9 161.5C3.4-72.6 357.8-25.2 438.3 239.5 491.9 415.6 681.7 511.3 855.2 449.7L1033.4 386.5C1160 341.6 1299.9 401 1355.4 523.3'],
    proc:[1286,712,'top:11px','M1504.5 251.1L1388.5 119.1C1197.7-98 839.6 31.7 832.1 320.6 827.1 513.6 652.6 657.5 462.2 625.8L305.1 599.6C169.3 576.9 39.5 664.8 10.3 799.5']
  },lines=[],raf=0;
  document.querySelectorAll('[data-curve]').forEach(function(sec){
    var c=curves[sec.getAttribute('data-curve')];if(!c)return;
    sec.insertAdjacentHTML('afterbegin','<svg class="curve" style="'+c[2]+'" viewBox="0 0 '+c[0]+' '+c[1]+'" aria-hidden="true"><path d="'+c[3]+'"/></svg>');
    var p=sec.firstChild.firstChild,len=p.getTotalLength();
    p.style.strokeDasharray=len;lines.push([p,len]);
  });
  function draw(){
    raf=0;var vh=innerHeight;
    lines.forEach(function(l){
      var r=l[0].ownerSVGElement.getBoundingClientRect(),k=still?1:Math.min(1,Math.max(0,(vh-r.top)/(vh/2+r.height/2)));
      l[0].style.strokeDashoffset=l[1]*(1-k);
    });
  }
  function queue(){if(!raf)raf=requestAnimationFrame(draw)}
  if(lines.length){addEventListener('scroll',queue,{passive:true});addEventListener('resize',queue);draw()}

  // about timeline: highlight and scroll the active year into the start of the row
  document.querySelectorAll('.tl').forEach(function(tl){
    var li=tl.querySelectorAll('li'),rtl=getComputedStyle(tl).direction==='rtl',bar=tl.nextElementSibling,fill=bar&&bar.querySelector('span'),n=li.length;
    var go=cycle(tl,n,function(i){
      li.forEach(function(el,j){el.classList.toggle('on',j===i)});
      if(fill)fill.style.width=(n>1?i/(n-1)*100:0)+'%';
      var a=li[i].getBoundingClientRect(),c=tl.getBoundingClientRect();
      tl.scrollBy({left:rtl?a.right-c.right:a.left-c.left,behavior:still?'auto':'smooth'});
    },4000);
    onPick(li,go);
    if(fill)bar.addEventListener('click',function(e){
      var r=bar.getBoundingClientRect(),x=(rtl?r.right-e.clientX:e.clientX-r.left)/r.width;
      go(Math.round(Math.min(1,Math.max(0,x))*(n-1)));
    });
  });
})();
