// Spike 1a.1 — CSP probe content script. Runs once, writes result to DOM.
(async () => {
  const violations = [];
  document.addEventListener('securitypolicyviolation', (e) => {
    violations.push({ violatedDirective: e.violatedDirective, blockedURI: e.blockedURI });
  });

  const host = document.createElement('div');
  host.id = 'spike-csp-host';
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });

  let shadowAttached = !!shadow;
  let shadowStyleHeight = null;
  let adoptedStyleHeight = null;
  let mermaidLoaded = typeof globalThis.mermaid !== 'undefined';
  let mermaidSvgWidth = null;
  let mermaidSvgHeight = null;
  let foreignObjectHeight = null;
  let mermaidError = null;

  try {
    const style = document.createElement('style');
    style.textContent = '.probe { height: 42px }';
    shadow.appendChild(style);
    const probe = document.createElement('div');
    probe.className = 'probe';
    shadow.appendChild(probe);
    shadowStyleHeight = getComputedStyle(probe).height;
  } catch (err) {
    mermaidError = mermaidError || `shadow-style: ${err.message}`;
  }

  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync('.probe-adopted { height: 24px }');
    shadow.adoptedStyleSheets = [sheet];
    const adopted = document.createElement('div');
    adopted.className = 'probe-adopted';
    shadow.appendChild(adopted);
    adoptedStyleHeight = getComputedStyle(adopted).height;
  } catch (err) {
    mermaidError = mermaidError || `adopted-style: ${err.message}`;
  }

  if (mermaidLoaded) {
    try {
      globalThis.mermaid.initialize({ startOnLoad: false });
      const { svg } = await globalThis.mermaid.render('spike', 'graph TD; A-->B');
      const wrapper = document.createElement('div');
      wrapper.innerHTML = svg;
      shadow.appendChild(wrapper);
      const svgEl = wrapper.querySelector('svg');
      if (svgEl) {
        const box = svgEl.getBoundingClientRect();
        mermaidSvgWidth = box.width;
        mermaidSvgHeight = box.height;
      }
      const fo = wrapper.querySelector('foreignObject');
      if (fo) {
        foreignObjectHeight = fo.getBoundingClientRect().height;
      }
    } catch (err) {
      mermaidError = err && err.message ? err.message : String(err);
    }
  }

  document.documentElement.setAttribute(
    'data-spike-result',
    JSON.stringify({
      url: location.href,
      shadowAttached,
      shadowStyleHeight,
      adoptedStyleHeight,
      mermaidLoaded,
      mermaidSvgWidth,
      mermaidSvgHeight,
      foreignObjectHeight,
      mermaidError,
      violations,
    })
  );
})();
