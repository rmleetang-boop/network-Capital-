import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, FileLock, ExternalLink, Briefcase, X, LogIn } from 'lucide-react';

const Footer = () => {
  const navigate = useNavigate();
  const [showCareersModal, setShowCareersModal] = useState(false);

  const handleCareersClick = (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (token) {
      navigate('/jobs');
    } else {
      setShowCareersModal(true);
    }
  };

  return (
    <>
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
              <li>• We coordinate <strong className="text-white">social capital</strong> and group access.</li>
            </ul>
            <p className="text-[11px] text-white/50 mt-3"><strong className="text-white/70">Available:</strong> Web today · iOS + Android coming soon.</p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-heading font-bold text-white mb-3">More</h4>
            <ul className="text-sm space-y-2">
              <li>
                <a
                  href="/jobs"
                  onClick={handleCareersClick}
                  className="hover:text-secondary inline-flex items-center gap-1.5"
                  data-testid="footer-careers-link"
                >
                  <Briefcase size={13} /> Careers
                </a>
              </li>
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

      {/* Careers — Sign-in required popup */}
      {showCareersModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowCareersModal(false)}
          data-testid="careers-signin-modal"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0f1d35] border border-white/10 rounded-2xl max-w-md w-full p-6 relative"
          >
            <button
              onClick={() => setShowCareersModal(false)}
              className="absolute top-3 right-3 text-white/60 hover:text-white p-1 rounded-full hover:bg-white/10"
              data-testid="careers-modal-close"
            >
              <X size={18} />
            </button>
            <div className="w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center mb-4">
              <Briefcase size={22} className="text-secondary" />
            </div>
            <h3 className="font-heading font-bold text-white text-xl mb-2">Sign in to view careers</h3>
            <p className="text-sm text-white/70 leading-relaxed mb-5">
              Network Capital's Careers portal is open to verified members. Create a free account or log in to browse open roles, apply with your CV, and post jobs as a Professional.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => { setShowCareersModal(false); navigate('/auth'); }}
                className="flex-1 bg-secondary hover:brightness-110 text-primary font-bold px-4 py-2.5 rounded-full text-sm inline-flex items-center justify-center gap-2 active:scale-95 transition-all"
                data-testid="careers-modal-signin"
              >
                <LogIn size={14} /> Sign in / Join
              </button>
              <button
                onClick={() => setShowCareersModal(false)}
                className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white px-4 py-2.5 rounded-full text-sm"
                data-testid="careers-modal-dismiss"
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Footer;
