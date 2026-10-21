/* Enquiry form: validation + POST JSON to the Azure Function in data-endpoint */
(function(){
  var AR=document.documentElement.lang==='ar',TRUSTED='Trusted Verification Service',EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var T=AR?{req:'هذا الحقل مطلوب.',email:'يرجى إدخال بريد إلكتروني صحيح.',check:'يرجى استكمال الحقول المحددة.',sending:'جارٍ الإرسال...',ok:'شكراً لكم. تم إرسال طلبكم بنجاح وسيتواصل معكم فريقنا قريباً.',fail:'عذراً، تعذّر إرسال طلبكم حالياً. يرجى المحاولة مرة أخرى لاحقاً.'}
    :{req:'This field is required.',email:'Please enter a valid email address.',check:'Please complete the highlighted fields.',sending:'Sending...',ok:'Thank you. Your enquiry has been sent successfully and our team will contact you soon.',fail:'Sorry, we could not send your enquiry right now. Please try again later.'};
  function err(c,m){var f=c.closest('.field');if(!f)return;var e=f.querySelector('.err');c.setAttribute('aria-invalid',!!m);if(!m){if(e)e.remove();return}if(!e){e=document.createElement('span');e.className='err';f.appendChild(e)}e.textContent=m}
  document.querySelectorAll('form.form').forEach(function(form){
    var area=form.elements['area-of-interest'],type=form.elements['verification-type'],wrap=type&&type.closest('.field'),msg=form.querySelector('.msg'),btn=form.querySelector('[type=submit]');
    function sync(){var on=area.value===TRUSTED;wrap.hidden=!on;type.disabled=!on;type.required=on;if(!on){type.value='';err(type)}}
    if(area&&type){area.addEventListener('change',sync);sync()}
    form.addEventListener('input',function(e){if(e.target.name)err(e.target)});
    form.addEventListener('submit',function(e){
      e.preventDefault();msg.textContent='';msg.className='msg';
      var bad=null;
      Array.prototype.forEach.call(form.querySelectorAll('input:not([type=hidden]),select,textarea'),function(c){
        if(c.disabled||c.closest('.hp'))return;var v=c.value.trim(),m='';
        if(c.required&&!v)m=T.req;else if(c.type==='email'&&v&&!EMAIL.test(v))m=T.email;
        err(c,m);if(m&&!bad)bad=c});
      if(bad){bad.focus();msg.textContent=T.check;msg.className='msg bad';return}
      var data={},label=btn.textContent;new FormData(form).forEach(function(v,k){data[k]=v});
      data.page_language=AR?'Arabic':'English';data.page_url=location.href;
      btn.disabled=true;btn.textContent=T.sending;
      fetch(form.dataset.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})
        .then(function(r){if(!r.ok)throw r.status;form.reset();if(area)sync();msg.textContent=T.ok;msg.className='msg ok'})
        .catch(function(){msg.textContent=T.fail;msg.className='msg bad'})
        .then(function(){btn.disabled=false;btn.textContent=label});
    });
  });
})();
