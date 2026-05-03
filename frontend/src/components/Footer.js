import React from 'react';
import { Shield, FileLock, ExternalLink } from 'lucide-react';

const Footer = () => (
  <footer className="bg-[#0a1628] text-white/80 mt-12 border-t border-white/10" data-testid="public-footer">
    <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-1 md:grid-cols-3 gap-8">
      {/* POPIA / Data Protection */}
      <div data-testid="footer-popia">
        <div className="flex items-center gap-2 mb-3">
          <FileLock size={18} className="text-secondary" />
          <h4 className="font-heading font-bold text-white">Data Protection &amp; POPIA Commitment</h4>
        </div>
        <p className="text-sm leading-relaxed">
          Network Capital is committed to protecting your personal information in line with the
          <strong className="text-white"> Protection of Personal Information Act (POPIA)</strong> and equivalent
          regional regulations. We collect only what's needed to coordinate participation, never sell your data,
          and you may request a copy or deletion at any time.
        </p>
      </div>

      {/* Transparency snapshot */}
      <div data-testid="footer-transparency">
        <div className="flex items-center gap-2 mb-3">
          <Shield size={18} className="text-secondary" />
          <h4 className="font-heading font-bold text-white">Transparency First</h4>
        </div>
        <ul className="text-sm space-y-1.5">
          <li>• We are <strong className="text-white">not</strong> a financial services provider.</li>
          <li>• We do <strong className="text-white">not</strong> promise returns.</li>
          <li>• We coordinate participation, access, and shared benefits.</li>
        </ul>
      </div>

      {/* Links */}
      <div>
        <h4 className="font-heading font-bold text-white mb-3">More</h4>
        <ul className="text-sm space-y-2">
          <li><a href="/legal" className="hover:text-secondary inline-flex items-center gap-1">Legal &amp; Terms <ExternalLink size={12} /></a></li>
          <li><a href="/help" className="hover:text-secondary inline-flex items-center gap-1">Help Centre <ExternalLink size={12} /></a></li>
          <li><a href="mailto:hello@networkcapital.app" className="hover:text-secondary">Contact</a></li>
        </ul>
      </div>
    </div>
    <div className="border-t border-white/10 px-6 py-4 text-center text-xs text-white/50">
      © {new Date().getFullYear()} Network Capital · Powered by Mici Business pty ltd
    </div>
  </footer>
);

export default Footer;
