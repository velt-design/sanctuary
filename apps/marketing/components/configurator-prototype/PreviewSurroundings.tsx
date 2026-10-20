import { PreviewSurroundings as Shared } from '@sp/configurator/react';
import type {ComponentProps} from 'react';
import PreviewLandscape from './PreviewLandscape';
import StudioFacade from './StudioFacade';
export default function PreviewSurroundings(props:ComponentProps<typeof Shared>){return <Shared {...props} renderLandscape={args=><PreviewLandscape {...args} reducedDetail={props.reducedDetail}/>} renderFacade={context=><StudioFacade context={context}/>}/>;}
