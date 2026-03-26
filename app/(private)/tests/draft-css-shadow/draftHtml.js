/** Full standalone HTML document used for the draft-css-shadow test page. */
export const DRAFT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tax Report Service in Bay Area | Bay Area Tax Experts</title>
  <style>
    :root {
      --color-navy:       #1a2e4a;
      --color-navy-light: #2a4268;
      --color-gold:       #c8922a;
      --color-gold-light: #e6a83a;
      --color-off-white:  #f7f6f3;
      --color-white:      #ffffff;
      --color-gray-100:   #f0efe9;
      --color-gray-200:   #e2e0d8;
      --color-gray-400:   #9b9888;
      --color-gray-600:   #5c5a52;
      --color-gray-800:   #2e2c26;
      --color-text:       #1a2e4a;
      --color-text-muted: #5c5a52;
      --font-heading:     'Georgia', 'Times New Roman', serif;
      --font-body:        'Helvetica Neue', 'Arial', sans-serif;
      --radius-sm:        4px;
      --radius-md:        8px;
      --radius-lg:        12px;
      --shadow-sm:        0 1px 3px rgba(0,0,0,0.08);
      --shadow-md:        0 4px 16px rgba(0,0,0,0.10);
      --shadow-lg:        0 8px 32px rgba(0,0,0,0.13);
      --max-w:            1160px;
    }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    html { scroll-behavior: smooth; }

    body {
      font-family: var(--font-body);
      color: var(--color-text);
      background: var(--color-white);
      line-height: 1.6;
      font-size: 16px;
      -webkit-font-smoothing: antialiased;
    }

    img { max-width: 100%; display: block; }
    a { color: inherit; text-decoration: none; }
    ul { list-style: none; }

    .container {
      max-width: var(--max-w);
      margin: 0 auto;
      padding: 0 24px;
    }

    .section-label {
      display: inline-block;
      font-family: var(--font-body);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--color-gold);
      margin-bottom: 12px;
    }

    h1, h2, h3, h4 {
      font-family: var(--font-heading);
      line-height: 1.25;
      color: var(--color-navy);
    }

    h1 { font-size: clamp(2rem, 5vw, 3.2rem); }
    h2 { font-size: clamp(1.6rem, 3.5vw, 2.4rem); }
    h3 { font-size: clamp(1.1rem, 2vw, 1.35rem); }

    p { line-height: 1.7; color: var(--color-text-muted); }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 14px 28px;
      border-radius: var(--radius-sm);
      font-family: var(--font-body);
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: background 0.2s, color 0.2s, box-shadow 0.2s;
      text-decoration: none;
    }

    .btn-primary { background: var(--color-gold); color: var(--color-white); }
    .btn-primary:hover { background: var(--color-gold-light); box-shadow: var(--shadow-md); }

    .btn-outline {
      background: transparent;
      color: var(--color-navy);
      border: 2px solid var(--color-navy);
    }
    .btn-outline:hover { background: var(--color-navy); color: var(--color-white); }

    .btn-white { background: var(--color-white); color: var(--color-navy); }
    .btn-white:hover { background: var(--color-off-white); }

    .site-header {
      position: sticky;
      top: 0;
      z-index: 100;
      background: var(--color-navy);
      box-shadow: 0 2px 8px rgba(0,0,0,0.18);
    }

    .header-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 68px;
    }

    .logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }

    .logo-icon {
      width: 38px; height: 38px;
      background: var(--color-gold);
      border-radius: var(--radius-sm);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }

    .logo-text {
      font-family: var(--font-heading);
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--color-white);
      line-height: 1.2;
    }

    .logo-text span {
      display: block;
      font-size: 0.72rem;
      font-family: var(--font-body);
      font-weight: 400;
      color: var(--color-gray-400);
      letter-spacing: 0.06em;
    }

    .main-nav { display: flex; align-items: center; gap: 32px; }

    .main-nav a {
      font-size: 14px; font-weight: 500;
      color: var(--color-gray-200);
      text-decoration: none;
      transition: color 0.15s;
      letter-spacing: 0.02em;
    }
    .main-nav a:hover { color: var(--color-gold-light); }

    .header-cta { display: flex; align-items: center; gap: 12px; }

    .header-phone {
      font-size: 14px; font-weight: 600;
      color: var(--color-gold-light);
      letter-spacing: 0.02em;
    }

    .nav-toggle { display: none; background: none; border: none; cursor: pointer; padding: 4px; }

    .hero {
      background: var(--color-navy);
      padding: 72px 0 64px;
      overflow: hidden;
      position: relative;
    }

    .hero::after {
      content: '';
      position: absolute;
      right: 0; top: 0; bottom: 0;
      width: 42%;
      background: var(--color-navy-light);
      clip-path: polygon(8% 0, 100% 0, 100% 100%, 0% 100%);
      z-index: 0;
    }

    .hero-inner {
      position: relative; z-index: 1;
      display: flex; align-items: center; gap: 56px;
    }

    .hero-content { flex: 1 1 55%; }

    .hero-badge {
      display: inline-flex; align-items: center; gap: 8px;
      background: rgba(200, 146, 42, 0.18);
      border: 1px solid rgba(200, 146, 42, 0.4);
      border-radius: 20px;
      padding: 6px 14px;
      font-size: 13px; font-weight: 600;
      color: var(--color-gold-light);
      margin-bottom: 20px;
    }

    .hero h1 { color: var(--color-white); margin-bottom: 20px; }

    .hero-sub {
      font-size: 17px;
      color: var(--color-gray-200);
      max-width: 540px;
      margin-bottom: 32px;
      line-height: 1.65;
    }

    .hero-actions { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }

    .hero-stats {
      display: flex; gap: 32px;
      margin-top: 48px; padding-top: 32px;
      border-top: 1px solid rgba(255,255,255,0.12);
      flex-wrap: wrap;
    }

    .hero-stat-value {
      font-family: var(--font-heading);
      font-size: 2rem; font-weight: 700;
      color: var(--color-gold-light);
      line-height: 1;
    }

    .hero-stat-label { font-size: 13px; color: var(--color-gray-400); margin-top: 4px; line-height: 1.4; }

    .hero-visual { flex: 0 0 340px; display: flex; flex-direction: column; gap: 14px; }

    .hero-card {
      background: var(--color-white);
      border-radius: var(--radius-md);
      padding: 20px 22px;
      box-shadow: var(--shadow-lg);
    }

    .hero-card-label {
      font-size: 11px; font-weight: 700;
      letter-spacing: 0.1em; text-transform: uppercase;
      color: var(--color-gray-400); margin-bottom: 8px;
    }

    .hero-card-value {
      font-family: var(--font-heading);
      font-size: 1.5rem; color: var(--color-navy); font-weight: 700;
    }

    .hero-card-sub { font-size: 13px; color: var(--color-gray-600); margin-top: 4px; }

    .hero-card-row { display: flex; align-items: center; justify-content: space-between; }

    .status-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: #22c55e; display: inline-block; margin-right: 5px;
    }

    .status-text { font-size: 12px; color: #22c55e; font-weight: 600; }

    .trust-bar {
      background: var(--color-gray-100);
      border-top: 1px solid var(--color-gray-200);
      border-bottom: 1px solid var(--color-gray-200);
      padding: 18px 0;
    }

    .trust-bar-inner {
      display: flex; align-items: center; justify-content: center;
      gap: 40px; flex-wrap: wrap;
    }

    .trust-item {
      display: flex; align-items: center; gap: 8px;
      font-size: 13px; font-weight: 600;
      color: var(--color-navy); letter-spacing: 0.02em;
    }

    .trust-item svg { color: var(--color-gold); flex-shrink: 0; }

    .section { padding: 80px 0; }
    .section-alt { background: var(--color-off-white); }

    .section-header { margin-bottom: 48px; }
    .section-header.centered { text-align: center; max-width: 680px; margin: 0 auto 48px; }
    .section-header h2 { margin-bottom: 14px; }
    .section-header p { font-size: 17px; }

    .services-tabs {
      display: flex; gap: 0;
      border-bottom: 2px solid var(--color-gray-200);
      margin-bottom: 40px;
    }

    .tab-btn {
      padding: 12px 28px;
      font-size: 15px; font-weight: 600; font-family: var(--font-body);
      background: none; border: none;
      border-bottom: 3px solid transparent;
      margin-bottom: -2px;
      cursor: pointer;
      color: var(--color-gray-600);
      transition: color 0.15s, border-color 0.15s;
    }

    .tab-btn.active { color: var(--color-navy); border-bottom-color: var(--color-gold); }
    .tab-btn:hover { color: var(--color-navy); }

    .tab-panel { display: none; }
    .tab-panel.active { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }

    .service-card {
      background: var(--color-white);
      border: 1px solid var(--color-gray-200);
      border-radius: var(--radius-md);
      padding: 28px 28px 24px;
      transition: box-shadow 0.2s, border-color 0.2s;
    }

    .service-card:hover { box-shadow: var(--shadow-md); border-color: var(--color-gold); }

    .service-icon {
      width: 44px; height: 44px;
      background: rgba(200, 146, 42, 0.12);
      border-radius: var(--radius-sm);
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 16px; color: var(--color-gold);
    }

    .service-card h3 { margin-bottom: 10px; }
    .service-card p { font-size: 14px; margin-bottom: 16px; }

    .service-list { display: flex; flex-direction: column; gap: 7px; }

    .service-list li {
      display: flex; align-items: flex-start; gap: 9px;
      font-size: 14px; color: var(--color-gray-600);
    }

    .service-list li::before {
      content: '';
      width: 16px; height: 16px; flex-shrink: 0;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Ccircle cx='8' cy='8' r='8' fill='%23c8922a' opacity='0.15'/%3E%3Cpath d='M4.5 8l2.5 2.5 4.5-4.5' stroke='%23c8922a' stroke-width='1.6' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C%2Fsvg%3E");
      background-size: contain; margin-top: 2px;
    }

    .why-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }

    .why-card {
      padding: 28px 24px; border-radius: var(--radius-md);
      background: var(--color-white); border: 1px solid var(--color-gray-200);
      text-align: center; transition: box-shadow 0.2s;
    }
    .why-card:hover { box-shadow: var(--shadow-md); }

    .why-icon {
      width: 52px; height: 52px; background: var(--color-navy); border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 16px; color: var(--color-gold-light);
    }

    .why-card h3 { margin-bottom: 8px; font-size: 1.05rem; }
    .why-card p { font-size: 14px; }

    .credentials-wrap { display: flex; gap: 56px; align-items: center; }
    .credentials-content { flex: 1 1 50%; }
    .credentials-visual  { flex: 0 0 44%; }
    .credentials-content h2 { margin-bottom: 16px; }
    .credentials-content p  { margin-bottom: 24px; }

    .cred-list { display: flex; flex-direction: column; gap: 14px; margin-bottom: 28px; }

    .cred-item {
      display: flex; align-items: flex-start; gap: 12px;
      padding: 14px 16px; border-radius: var(--radius-sm);
      background: var(--color-gray-100); border-left: 3px solid var(--color-gold);
    }

    .cred-item svg { color: var(--color-gold); flex-shrink: 0; margin-top: 1px; }
    .cred-item-text { font-size: 14px; color: var(--color-gray-600); line-height: 1.5; }
    .cred-item-text strong { color: var(--color-navy); display: block; font-size: 15px; margin-bottom: 2px; }

    .cert-badges { display: flex; gap: 12px; flex-wrap: wrap; }

    .cert-badge {
      display: inline-flex; align-items: center; gap: 7px;
      padding: 8px 14px; border-radius: 20px;
      background: var(--color-gray-100); border: 1px solid var(--color-gray-200);
      font-size: 12px; font-weight: 700; color: var(--color-navy); letter-spacing: 0.05em;
    }
    .cert-badge svg { color: var(--color-gold); }

    .creds-img-placeholder {
      background: var(--color-gray-100); border-radius: var(--radius-lg);
      aspect-ratio: 4/3; display: flex; align-items: center; justify-content: center;
      position: relative; overflow: hidden; border: 1px solid var(--color-gray-200);
    }
    .creds-img-placeholder svg { color: var(--color-gray-400); }

    .placeholder-label {
      position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%);
      background: rgba(26,46,74,0.75); color: var(--color-white);
      font-size: 12px; padding: 5px 12px; border-radius: 12px;
      white-space: nowrap; font-weight: 500;
    }

    .pricing-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 8px; }

    .price-card {
      background: var(--color-white); border: 2px solid var(--color-gray-200);
      border-radius: var(--radius-md); padding: 32px 28px;
      transition: box-shadow 0.2s, border-color 0.2s; position: relative;
    }
    .price-card:hover { box-shadow: var(--shadow-md); }
    .price-card.featured { border-color: var(--color-gold); box-shadow: var(--shadow-md); }

    .price-badge {
      position: absolute; top: -12px; left: 50%; transform: translateX(-50%);
      background: var(--color-gold); color: var(--color-white);
      font-size: 11px; font-weight: 700; letter-spacing: 0.08em;
      padding: 4px 14px; border-radius: 10px; text-transform: uppercase;
    }

    .price-tier { font-size: 12px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-gold); margin-bottom: 8px; }
    .price-card h3 { margin-bottom: 6px; font-size: 1.2rem; }
    .price-desc { font-size: 13px; color: var(--color-gray-600); margin-bottom: 20px; }

    .price-amount {
      font-family: var(--font-heading); font-size: 2.4rem;
      color: var(--color-navy); font-weight: 700; margin-bottom: 4px; line-height: 1;
    }

    .price-from { font-size: 14px; color: var(--color-gray-400); margin-bottom: 20px; }

    .price-features { display: flex; flex-direction: column; gap: 8px; margin-bottom: 24px; }

    .price-features li {
      display: flex; align-items: flex-start; gap: 9px;
      font-size: 14px; color: var(--color-gray-600);
    }

    .price-features li::before {
      content: ''; width: 16px; height: 16px; flex-shrink: 0;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Ccircle cx='8' cy='8' r='8' fill='%23c8922a' opacity='0.15'/%3E%3Cpath d='M4.5 8l2.5 2.5 4.5-4.5' stroke='%23c8922a' stroke-width='1.6' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C%2Fsvg%3E");
      background-size: contain; margin-top: 2px;
    }

    .pricing-note { text-align: center; margin-top: 28px; font-size: 14px; color: var(--color-gray-600); }
    .pricing-note a { color: var(--color-gold); font-weight: 600; text-decoration: underline; }

    .hours-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; align-items: start; }

    .hours-table { width: 100%; border-collapse: collapse; font-size: 14px; }

    .hours-table th {
      text-align: left; padding: 10px 12px;
      background: var(--color-navy); color: var(--color-gray-200);
      font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
    }

    .hours-table th:first-child { border-radius: var(--radius-sm) 0 0 0; }
    .hours-table th:last-child  { border-radius: 0 var(--radius-sm) 0 0; }

    .hours-table td {
      padding: 10px 12px; border-bottom: 1px solid var(--color-gray-200);
      color: var(--color-gray-600);
    }

    .hours-table tr:last-child td { border-bottom: none; }
    .hours-table tr:nth-child(even) td { background: var(--color-gray-100); }
    .hours-table td.open { color: #166534; font-weight: 600; }

    .delivery-options { display: flex; flex-direction: column; gap: 14px; }

    .delivery-option {
      display: flex; align-items: flex-start; gap: 14px;
      padding: 16px 18px; background: var(--color-white);
      border: 1px solid var(--color-gray-200); border-radius: var(--radius-md);
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .delivery-option:hover { border-color: var(--color-gold); box-shadow: var(--shadow-sm); }

    .delivery-icon {
      width: 40px; height: 40px; background: rgba(200, 146, 42, 0.12);
      border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; color: var(--color-gold);
    }

    .delivery-option h4 { font-size: 15px; margin-bottom: 3px; color: var(--color-navy); font-family: var(--font-body); font-weight: 700; }
    .delivery-option p  { font-size: 13px; margin: 0; }

    .specialty-layout { display: flex; gap: 56px; align-items: center; }
    .specialty-visual { flex: 0 0 42%; }
    .specialty-content { flex: 1 1 50%; }
    .specialty-content h2 { margin-bottom: 14px; }
    .specialty-content > p { margin-bottom: 28px; }

    .issue-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

    .issue-card {
      padding: 16px; background: var(--color-off-white);
      border-radius: var(--radius-sm); border: 1px solid var(--color-gray-200);
    }
    .issue-card h4 { font-size: 14px; color: var(--color-navy); margin-bottom: 4px; font-family: var(--font-body); font-weight: 700; }
    .issue-card p { font-size: 13px; }

    .specialty-placeholder {
      background: var(--color-gray-100); border-radius: var(--radius-lg);
      aspect-ratio: 4/3; display: flex; align-items: center; justify-content: center;
      position: relative; border: 1px solid var(--color-gray-200); overflow: hidden;
    }

    .security-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; }

    .security-item {
      text-align: center; padding: 28px 18px; background: var(--color-white);
      border-radius: var(--radius-md); border: 1px solid var(--color-gray-200);
    }

    .security-item svg { color: var(--color-gold); margin: 0 auto 12px; display: block; }
    .security-item h4 { font-size: 15px; margin-bottom: 6px; }
    .security-item p  { font-size: 13px; }

    .testimonials-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }

    .testimonial-card {
      background: var(--color-white); border: 1px solid var(--color-gray-200);
      border-radius: var(--radius-md); padding: 28px 24px; position: relative;
    }

    .stars { display: flex; gap: 3px; margin-bottom: 14px; }
    .stars svg { color: var(--color-gold); }

    .testimonial-text { font-size: 15px; color: var(--color-gray-600); line-height: 1.65; margin-bottom: 20px; }

    .testimonial-author { display: flex; align-items: center; gap: 10px; }

    .author-avatar {
      width: 40px; height: 40px; border-radius: 50%; background: var(--color-navy);
      display: flex; align-items: center; justify-content: center;
      font-family: var(--font-heading); font-size: 16px; font-weight: 700;
      color: var(--color-gold-light); flex-shrink: 0;
    }

    .author-name  { font-size: 14px; font-weight: 700; color: var(--color-navy); }
    .author-title { font-size: 12px; color: var(--color-gray-400); }

    .cta-section { background: var(--color-navy); padding: 72px 0; text-align: center; }
    .cta-section h2 { color: var(--color-white); margin-bottom: 14px; }
    .cta-section p  { color: var(--color-gray-200); font-size: 17px; max-width: 560px; margin: 0 auto 32px; }

    .cta-actions { display: flex; justify-content: center; gap: 16px; flex-wrap: wrap; }

    .cta-phone-block { margin-top: 28px; font-size: 14px; color: var(--color-gray-400); }
    .cta-phone-block a { color: var(--color-gold-light); font-weight: 600; font-size: 18px; }

    .site-footer { background: #101e30; padding: 56px 0 32px; }

    .footer-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 40px; margin-bottom: 40px; }

    .footer-brand p {
      font-size: 14px; color: var(--color-gray-400);
      line-height: 1.7; margin-top: 12px; max-width: 280px;
    }

    .footer-col h4 {
      font-family: var(--font-body); font-size: 12px; font-weight: 700;
      letter-spacing: 0.1em; text-transform: uppercase;
      color: var(--color-gray-400); margin-bottom: 16px;
    }

    .footer-links { display: flex; flex-direction: column; gap: 8px; }

    .footer-links a { font-size: 14px; color: var(--color-gray-200); text-decoration: none; transition: color 0.15s; }
    .footer-links a:hover { color: var(--color-gold-light); }

    .footer-contact-item {
      display: flex; align-items: flex-start; gap: 8px;
      font-size: 14px; color: var(--color-gray-200); margin-bottom: 10px; line-height: 1.5;
    }
    .footer-contact-item svg { color: var(--color-gold); flex-shrink: 0; margin-top: 2px; }

    .footer-bottom {
      border-top: 1px solid rgba(255,255,255,0.08); padding-top: 24px;
      display: flex; align-items: center; justify-content: space-between;
      font-size: 13px; color: var(--color-gray-400); flex-wrap: wrap; gap: 12px;
    }
    .footer-bottom a { color: var(--color-gray-400); text-decoration: underline; }
    .footer-bottom a:hover { color: var(--color-gray-200); }

    .license-badges { display: flex; gap: 12px; flex-wrap: wrap; }

    .lic-badge {
      font-size: 11px; padding: 3px 8px;
      border: 1px solid rgba(255,255,255,0.15); border-radius: 4px;
      color: var(--color-gray-400); letter-spacing: 0.05em;
    }

    @media (max-width: 1024px) {
      .footer-grid { grid-template-columns: 1fr 1fr; }
      .pricing-grid { grid-template-columns: 1fr 1fr; }
      .security-grid { grid-template-columns: 1fr 1fr; }
    }

    @media (max-width: 900px) {
      .hero::after { display: none; }
      .hero-inner { flex-direction: column; gap: 36px; }
      .hero-visual { flex: unset; width: 100%; max-width: 420px; }
      .credentials-wrap { flex-direction: column; }
      .credentials-visual { width: 100%; }
      .specialty-layout { flex-direction: column-reverse; }
      .specialty-visual { width: 100%; flex: unset; }
      .why-grid { grid-template-columns: 1fr 1fr; }
      .hours-grid { grid-template-columns: 1fr; }
      .testimonials-grid { grid-template-columns: 1fr; }
      .main-nav { display: none; }
      .nav-toggle { display: block; }
    }

    @media (max-width: 700px) {
      .tab-panel.active { grid-template-columns: 1fr; }
      .pricing-grid { grid-template-columns: 1fr; }
      .security-grid { grid-template-columns: 1fr 1fr; }
      .why-grid { grid-template-columns: 1fr; }
      .footer-grid { grid-template-columns: 1fr; }
      .issue-cards { grid-template-columns: 1fr; }
      .hero-stats { gap: 24px; }
      .trust-bar-inner { gap: 20px; }
      .services-tabs { overflow-x: auto; }
    }

    @media (max-width: 480px) {
      .section { padding: 56px 0; }
      .security-grid { grid-template-columns: 1fr; }
      .hero { padding: 48px 0; }
      .cta-section { padding: 52px 0; }
    }

    .mobile-nav {
      display: none; background: var(--color-navy-light);
      padding: 20px 24px; flex-direction: column; gap: 4px;
    }
    .mobile-nav.open { display: flex; }
    .mobile-nav a { padding: 10px 0; font-size: 15px; color: var(--color-gray-200); border-bottom: 1px solid rgba(255,255,255,0.08); }
    .mobile-nav a:last-child { border-bottom: none; }
    .mobile-nav a:hover { color: var(--color-gold-light); }
  </style>
</head>
<body>

  <header class="site-header" role="banner">
    <div class="container">
      <div class="header-inner">
        <a href="#" class="logo" aria-label="Bay Area Tax Experts — Home">
          <div class="logo-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          </div>
          <div class="logo-text">
            Bay Area Tax Experts
            <span>Tax Report Service &mdash; San Francisco Bay Area</span>
          </div>
        </a>
        <nav class="main-nav" aria-label="Primary navigation">
          <a href="#services">Services</a>
          <a href="#credentials">About Us</a>
          <a href="#pricing">Pricing</a>
          <a href="#hours">Hours</a>
          <a href="#specialty">Resolve Issues</a>
          <a href="#contact">Contact</a>
        </nav>
        <div class="header-cta">
          <a href="tel:+14155550100" class="header-phone" aria-label="Call us">(415) 555-0100</a>
          <a href="#contact" class="btn btn-primary" style="padding:10px 20px; font-size:13px;">Book Consultation</a>
        </div>
        <button class="nav-toggle" aria-label="Open navigation menu" aria-expanded="false" id="navToggle">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
    <nav class="mobile-nav" id="mobileNav" aria-label="Mobile navigation">
      <a href="#services">Services</a>
      <a href="#credentials">About Us</a>
      <a href="#pricing">Pricing</a>
      <a href="#hours">Hours &amp; Delivery</a>
      <a href="#specialty">Resolve Issues</a>
      <a href="#security">Security</a>
      <a href="#contact">Contact</a>
    </nav>
  </header>

  <main id="main-content">

    <section class="hero" aria-labelledby="hero-heading">
      <div class="container">
        <div class="hero-inner">
          <div class="hero-content">
            <div class="hero-badge" aria-label="Accepting new clients">
              <span class="status-dot" aria-hidden="true"></span>
              Now Accepting New Clients &mdash; Bay Area
            </div>
            <h1 id="hero-heading">Tax Report Service in Bay Area You Can Actually Count On</h1>
            <p class="hero-sub">
              Credentialed Bay Area tax experts handling individual and small business tax preparation in San Francisco and surrounding areas. Clear pricing, extended hours, and multiple ways to file.
            </p>
            <div class="hero-actions">
              <a href="#contact" class="btn btn-primary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                Book a Free Consultation
              </a>
              <a href="#services" class="btn btn-outline" style="color: #e2e0d8; border-color: rgba(226,224,216,0.45);">
                Explore Our Services
              </a>
            </div>
            <div class="hero-stats" aria-label="Key statistics">
              <div class="hero-stat">
                <div class="hero-stat-value">15+</div>
                <div class="hero-stat-label">Years Serving<br>Bay Area Clients</div>
              </div>
              <div class="hero-stat">
                <div class="hero-stat-value">2,800+</div>
                <div class="hero-stat-label">Returns Filed<br>Annually</div>
              </div>
              <div class="hero-stat">
                <div class="hero-stat-value">100%</div>
                <div class="hero-stat-label">IRS-Compliant<br>Filings</div>
              </div>
            </div>
          </div>
          <div class="hero-visual" aria-hidden="true">
            <div class="hero-card">
              <div class="hero-card-row">
                <div>
                  <div class="hero-card-label">Current Status</div>
                  <div class="hero-card-value">Open Today</div>
                  <div class="hero-card-sub">Mon &ndash; Fri: 9am &ndash; 7pm &nbsp;|&nbsp; Sat: 10am &ndash; 4pm</div>
                </div>
                <div style="text-align:right">
                  <span class="status-dot" style="background:#22c55e;"></span>
                  <span class="status-text">Open Now</span>
                </div>
              </div>
            </div>
            <div class="hero-card" style="margin-top:2px;">
              <div class="hero-card-label">Consultation Fee</div>
              <div class="hero-card-row" style="align-items:flex-end; gap:8px;">
                <div>
                  <div class="hero-card-value" style="color: var(--color-gold);">Free</div>
                  <div class="hero-card-sub">No obligation initial consultation</div>
                </div>
                <a href="#contact" class="btn btn-primary" style="padding:9px 16px; font-size:13px; flex-shrink:0;">Get Started</a>
              </div>
            </div>
            <div class="hero-card" style="margin-top:2px;">
              <div class="hero-card-label">How We Help</div>
              <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:4px;">
                <span style="font-size:12px; padding:4px 10px; background:var(--color-gray-100); border-radius:12px; color:var(--color-navy); font-weight:600;">In-Person</span>
                <span style="font-size:12px; padding:4px 10px; background:var(--color-gray-100); border-radius:12px; color:var(--color-navy); font-weight:600;">Phone</span>
                <span style="font-size:12px; padding:4px 10px; background:var(--color-gray-100); border-radius:12px; color:var(--color-navy); font-weight:600;">Remote</span>
                <span style="font-size:12px; padding:4px 10px; background:var(--color-gray-100); border-radius:12px; color:var(--color-navy); font-weight:600;">Self-Prep</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <div class="trust-bar" role="region" aria-label="Trust indicators">
      <div class="container">
        <div class="trust-bar-inner">
          <div class="trust-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            PTIN Registered Preparers
          </div>
          <div class="trust-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Extended Hours &mdash; 7 Days
          </div>
          <div class="trust-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Individuals &amp; Small Businesses
          </div>
          <div class="trust-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            Tax Services Near Me &mdash; Bay Area
          </div>
          <div class="trust-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="1" y="3" width="15" height="13" rx="1"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
            In-Person, Phone, or Remote Filing
          </div>
        </div>
      </div>
    </div>

    <section class="section" id="services" aria-labelledby="services-heading">
      <div class="container">
        <div class="section-header">
          <span class="section-label">Our Services</span>
          <h2 id="services-heading">Tax Preparation Services Tailored to Your Situation</h2>
          <p>Whether you are filing as an individual or running a small business in the Bay Area, we have a dedicated service track with clearly defined deliverables so you know exactly what you are getting.</p>
        </div>
        <div class="services-tabs" role="tablist" aria-label="Service categories">
          <button class="tab-btn active" role="tab" aria-selected="true" aria-controls="tab-individual" id="tab-btn-individual">For Individuals</button>
          <button class="tab-btn" role="tab" aria-selected="false" aria-controls="tab-business" id="tab-btn-business">For Small Businesses</button>
          <button class="tab-btn" role="tab" aria-selected="false" aria-controls="tab-special" id="tab-btn-special">Free &amp; Senior Programs</button>
        </div>
        <div class="tab-panel active" id="tab-individual" role="tabpanel" aria-labelledby="tab-btn-individual">
          <div class="service-card">
            <div class="service-icon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <h3>Individual Tax Preparation</h3>
            <p>Comprehensive federal and California state tax preparation for individuals and families.</p>
            <ul class="service-list">
              <li>Federal and California state tax return filing</li>
              <li>W-2, 1099, and self-employment income reporting</li>
              <li>Earned Income Tax Credit (EITC) and Child Tax Credit optimization</li>
              <li>Investment, rental, and capital gains reporting</li>
              <li>Prior year amended returns (Form 1040-X)</li>
            </ul>
          </div>
          <div class="service-card">
            <div class="service-icon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
            </div>
            <h3>Individual Tax Planning</h3>
            <p>Proactive tax strategy sessions that help you reduce your liability year-over-year.</p>
            <ul class="service-list">
              <li>Multi-year tax planning and projections</li>
              <li>Retirement account contribution strategies (IRA, 401k, SEP)</li>
              <li>Home purchase and mortgage deduction planning</li>
              <li>Withholding adjustment and estimated tax payments</li>
              <li>California Franchise Tax Board compliance review</li>
            </ul>
          </div>
        </div>
        <div class="tab-panel" id="tab-business" role="tabpanel" aria-labelledby="tab-btn-business">
          <div class="service-card">
            <div class="service-icon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
            </div>
            <h3>Small Business Tax Preparation</h3>
            <p>Tax preparation services designed for Bay Area small business owners, LLCs, and sole proprietors.</p>
            <ul class="service-list">
              <li>Business entity returns: Schedule C, Form 1065, 1120-S, 1120</li>
              <li>Self-employment tax calculation and deduction strategies</li>
              <li>Business expense and depreciation reporting</li>
              <li>Qualified Business Income (QBI) deduction optimization</li>
            </ul>
          </div>
          <div class="service-card">
            <div class="service-icon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            </div>
            <h3>Business Tax Advisory</h3>
            <p>Ongoing strategic tax guidance for Bay Area small business owners.</p>
            <ul class="service-list">
              <li>Entity structure review and tax impact analysis</li>
              <li>Quarterly estimated tax planning and payment guidance</li>
              <li>Section 179 and bonus depreciation strategy</li>
              <li>Year-end tax planning strategy session</li>
            </ul>
          </div>
        </div>
        <div class="tab-panel" id="tab-special" role="tabpanel" aria-labelledby="tab-btn-special">
          <div class="service-card">
            <div class="service-icon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            </div>
            <h3>Free Tax Preparation Programs</h3>
            <p>We connect qualifying Bay Area residents with IRS-certified free filing options.</p>
            <ul class="service-list">
              <li>Free tax filing for low-income households (VITA program)</li>
              <li>Free senior tax preparation near me (AARP Tax-Aide)</li>
              <li>Earned Income Tax Credit (EITC) screening and filing</li>
              <li>Multilingual support available (Spanish, Mandarin)</li>
            </ul>
          </div>
          <div class="service-card">
            <div class="service-icon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </div>
            <h3>Senior Tax Preparation</h3>
            <p>Dedicated, patient service for seniors in the San Francisco Bay Area.</p>
            <ul class="service-list">
              <li>Social Security benefit taxation analysis</li>
              <li>Pension, IRA, and 401(k) distribution reporting</li>
              <li>Required Minimum Distribution (RMD) guidance</li>
              <li>Medicare premium deduction opportunities</li>
            </ul>
          </div>
        </div>
      </div>
    </section>

  </main>

  <script>
    (function() {
      var toggle = document.getElementById('navToggle');
      var nav    = document.getElementById('mobileNav');
      if (!toggle || !nav) return;
      toggle.addEventListener('click', function() {
        var isOpen = nav.classList.toggle('open');
        toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });
      nav.querySelectorAll('a').forEach(function(link) {
        link.addEventListener('click', function() {
          nav.classList.remove('open');
          toggle.setAttribute('aria-expanded', 'false');
        });
      });
    }());

    (function() {
      var tabBtns   = document.querySelectorAll('.tab-btn');
      var tabPanels = document.querySelectorAll('.tab-panel');
      tabBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
          var target = btn.getAttribute('aria-controls');
          tabBtns.forEach(function(b) {
            b.classList.remove('active');
            b.setAttribute('aria-selected', 'false');
          });
          tabPanels.forEach(function(p) { p.classList.remove('active'); });
          btn.classList.add('active');
          btn.setAttribute('aria-selected', 'true');
          var panel = document.getElementById(target);
          if (panel) panel.classList.add('active');
        });
      });
    }());
  </script>

</body>
</html>`;
