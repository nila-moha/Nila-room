document.addEventListener('DOMContentLoaded', function () {
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.main-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      nav.classList.toggle('open');
    });
    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () { nav.classList.remove('open'); });
    });
  }

  var projectType = document.querySelector('#project-type');
  var conditionalGroups = document.querySelectorAll('.conditional-group');
  if (projectType && conditionalGroups.length) {
    function updateConditionalGroups() {
      var val = projectType.value;
      conditionalGroups.forEach(function (group) {
        var needs = (group.getAttribute('data-need') || '').split(' ');
        group.hidden = needs.indexOf(val) === -1;
      });
    }
    projectType.addEventListener('change', updateConditionalGroups);
    updateConditionalGroups();
  }

  var langSwitch = document.querySelector('.lang-switch');
  if (langSwitch) {
    var btn = langSwitch.querySelector('button');
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      langSwitch.classList.toggle('open');
    });
    document.addEventListener('click', function () {
      langSwitch.classList.remove('open');
    });
  }
});
