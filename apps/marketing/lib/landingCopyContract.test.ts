import {expect,it} from 'vitest';
import {copyChoice} from './landingCopyContract';
import {parseLandingCopies,landingControlText} from './landingExperiment';
it.each(['copy:design:Explore your outdoor space','copy:help:Plan your pergola project','copy:support:Choose your roof and size. See an installed estimate.'])('supports one authored plain-text surface: %s',value=>{
 const choice=copyChoice(value)!;expect(choice).not.toBeNull();expect(parseLandingCopies({[choice.slot]:value})).toEqual({[choice.slot]:value});
 expect(landingControlText('/auckland-outdoor-living',{[choice.slot]:value as `copy:design:${string}`})).toMatchObject({[choice.slot]:choice.text});
});
it.each(['copy:design:Free pergola','copy:design:Get 20 percent off','copy:support:Guaranteed waterproof roof','copy:help:<script>get your pergola</script>','copy:design:See https://example.test','copy:layout:Plan your space','copy:design:Plan  your space','copy:design:Plan your space!!'])('rejects new claims, effects, markup or malformed surfaces: %s',value=>expect(copyChoice(value)).toBeNull());
it('does not widen slots and preserves all previously retained changes',()=>{
 expect(parseLandingCopies({design:'copy:help:Plan your space'})).toBeNull();expect(parseLandingCopies({price:'explore'})).toBeNull();
 const copies=parseLandingCopies({design:'copy:design:Plan your pergola',help:'project',support:'estimate'})!;
 expect(landingControlText('/auckland-outdoor-living',copies)).toMatchObject({design:'Plan your pergola',help:'Tell us about your project',support:'Choose a size and roof. See an installed estimate.'});
});
