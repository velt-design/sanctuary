import type {StudioQuoteView} from '@sp/quote-format';

export default function QuoteStudioDesign({design,className}:{design:StudioQuoteView;className?:string}) {
  return <details className={className}>
    <summary>Design included with this quote · revision {design.revision}</summary>
    <p>These views stay with this quote when the working design changes.</p>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:16}}>
      {design.images.map(image=><figure key={image.kind} style={{margin:0}}>
        <img src={image.dataUrl} alt={`Frozen design ${image.kind}`} style={{width:'100%',height:'auto'}}/>
        <figcaption>{image.kind==='plan'?'Plan':'3D perspective'}</figcaption>
      </figure>)}
    </div>
    {design.selections.map((item,index)=><section key={index}>
      <h4>{item.label}</h4>{item.details.map((text,line)=><p key={line}>{text}</p>)}
    </section>)}
  </details>;
}
