/* Mali čitač za ekrane iz prototipa (isti šabloni: {{ }}, sc-if, sc-for, onClick). Bez servera. */
(function () {
  class DCLogic {
    constructor(props) { this.props = props || {}; this.state = {}; this._mount = null; }
    setState(patch) {
      this.state = Object.assign({}, this.state, patch);
      if (this._mount) { this._mount(); }
    }
    forceUpdate() { if (this._mount) { this._mount(); } }
  }
  window.DCLogic = DCLogic;

  function lookup(path, scope) {
    path = path.trim();
    if (path === 'true') { return true; }
    if (path === 'false') { return false; }
    if (/^-?\d+(\.\d+)?$/.test(path)) { return Number(path); }
    var cur = scope;
    var parts = path.split('.');
    for (var i = 0; i < parts.length; i++) {
      if (cur === null || cur === undefined) { return undefined; }
      cur = cur[parts[i]];
    }
    return cur;
  }

  var HOLE = /\{\{([^}]+)\}\}/g;
  function interpolate(str, scope) {
    return str.replace(HOLE, function (_, p) {
      var v = lookup(p, scope);
      return v === undefined || v === null ? '' : String(v);
    });
  }
  function wholeHole(str) {
    var m = /^\s*\{\{([^}]+)\}\}\s*$/.exec(str);
    return m ? m[1] : null;
  }

  function build(node, scope, parent) {
    if (node.nodeType === 3) {
      parent.appendChild(document.createTextNode(interpolate(node.nodeValue, scope)));
      return;
    }
    if (node.nodeType !== 1) { return; }
    var tag = node.localName;
    if (tag === 'sc-if') {
      var cond = lookup(wholeHole(node.getAttribute('value')) || 'false', scope);
      if (cond) { kids(node, scope, parent); }
      return;
    }
    if (tag === 'sc-for') {
      var list = lookup(wholeHole(node.getAttribute('list')) || '', scope) || [];
      var as = node.getAttribute('as') || 'item';
      list.forEach(function (item, i) {
        var s = Object.create(scope);
        s[as] = item;
        s.$index = i;
        kids(node, s, parent);
      });
      return;
    }
    var el = document.createElementNS(node.namespaceURI, node.localName);
    for (var a = 0; a < node.attributes.length; a++) {
      var name = node.attributes[a].name;
      var val = node.attributes[a].value;
      var whole = wholeHole(val);
      if (/^on[a-z]+$/.test(name) && whole) {
        var fn = lookup(whole, scope);
        if (typeof fn === 'function') { el.addEventListener(name.slice(2), fn); }
        continue;
      }
      if (name === 'checked') {
        el.checked = whole ? !!lookup(whole, scope) : true;
        continue;
      }
      var out = whole ? lookup(whole, scope) : interpolate(val, scope);
      if (out === undefined || out === null) { out = ''; }
      el.setAttribute(name, String(out));
      if (name === 'value' && 'value' in el) { el.value = String(out); }
    }
    kids(node, scope, el);
    parent.appendChild(el);
  }
  function kids(node, scope, parent) {
    for (var c = node.firstChild; c; c = c.nextSibling) { build(c, scope, parent); }
  }

  window.DCMount = function (Component, tplId, rootId) {
    var tpl = new DOMParser().parseFromString('<body>' + document.getElementById(tplId).textContent + '</body>', 'text/html').body;
    var root = document.getElementById(rootId);
    var inst = new Component({});
    function render() {
      var active = document.activeElement;
      var activeId = active && active.id ? active.id : null;
      var selStart = null, selEnd = null;
      if (activeId && active.selectionStart !== undefined) { selStart = active.selectionStart; selEnd = active.selectionEnd; }
      var vals = inst.renderVals();
      var frag = document.createDocumentFragment();
      kids(tpl, vals, frag);
      root.replaceChildren(frag);
      if (activeId) {
        var again = document.getElementById(activeId);
        if (again) {
          again.focus();
          if (selStart !== null) { try { again.setSelectionRange(selStart, selEnd); } catch (e) { /* ignore */ } }
        }
      }
    }
    inst._mount = render;
    if (inst.componentDidMount) { inst.componentDidMount(); }
    render();
  };
})();
