import {act} from 'react';
import {expect,it} from 'vitest';
import {renderIntoDocument} from '../../../../test/reactHarness';
import {useOwnedPortalPublication} from './PortalPageSource';
it('never lets a retired private producer publish or clear a newer owner, including null authority',()=>{
 let publish!:(value:string|null)=>void;
 function Host({owner}:{owner:object|null}){const source=useOwnedPortalPublication<string>(owner);publish=source.publish;return <output>{source.value??'Reading'}</output>;}
 const a={},b={},view=renderIntoDocument(<Host owner={null}/>);const noOwner=publish;act(()=>noOwner('Unverified'));expect(view.container.textContent).toBe('Reading');
 view.rerender(<Host owner={a}/>);const first=publish;act(()=>first('Verified A'));expect(view.container.textContent).toBe('Verified A');
 view.rerender(<Host owner={b}/>);const second=publish;act(()=>second('Verified B'));act(()=>{first('Late A');first(null);noOwner('Late unverified');});expect(view.container.textContent).toBe('Verified B');
 view.rerender(<Host owner={null}/>);act(()=>{second('Late B');second(null);});expect(view.container.textContent).toBe('Reading');view.unmount();
});
