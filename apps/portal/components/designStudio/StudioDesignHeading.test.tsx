import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it} from 'vitest';
import {studioDesignIdentity} from '@/lib/designStudio/studioDesignIdentity';
import type {EstimateDetail} from '@/lib/estimates/types';
import StudioDesignHeading from './StudioDesignHeading';

it('keeps saved names, design version, created date and quote revision distinct without changing source metadata',()=>{
 const estimate={internalName:'Courtyard / option B',createdAt:'2026-10-20T04:00:00Z',status:'draft',versionLabel:'V7',editability:{isLocked:true,hasDraftQuotes:false,draftQuoteCount:0,lockedByQuoteRef:'Q-1093',lockedByQuoteVersionNumber:3}} as EstimateDetail;
 const before=structuredClone(estimate),identity=studioDesignIdentity(estimate,'Garden project');
 const html=renderToStaticMarkup(<StudioDesignHeading identity={identity} versionLabel={estimate.versionLabel}/>);
 expect(html).toContain('Courtyard / option B');expect(html).toContain('Garden project');expect(html).toContain('Design V7');expect(html).toContain('quote revision 3');expect(html).toContain('Used by a quote');expect(html).toContain('20 Oct 2026');expect(estimate).toEqual(before);
});
it('uses display-only fallbacks and distinguishes archived history from an editable draft',()=>{
 const estimate={internalName:'',createdAt:'invalid',status:'archived',editability:{isLocked:false,hasDraftQuotes:false,draftQuoteCount:0}} as EstimateDetail;
 const identity=studioDesignIdentity(estimate,null),html=renderToStaticMarkup(<StudioDesignHeading identity={identity} versionLabel="V2"/>);
 expect(html).toContain('Untitled Studio design');expect(html).toContain('Archived design');expect(html).not.toContain('quote revision');expect(identity.createdAt).toBeNull();expect(estimate.internalName).toBe('');
});
