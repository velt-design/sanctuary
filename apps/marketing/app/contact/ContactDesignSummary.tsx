import type { ContactDesignBrief } from './contactDesignBrief';

export default function ContactDesignSummary({ design }: { design: ContactDesignBrief }) {
  return <div className="contact-form__field--wide" aria-label="Design included with your enquiry">
    <details>
      <summary>{design.label.replace(' acrylic pergola', '')} · {design.dimensions.widthM.toFixed(1)} × {design.dimensions.depthM.toFixed(1)} m <span>Details</span></summary>
      <p>{design.description}</p>
      <a href="#project-design">Edit your design ↑</a>
    </details>
    <input type="hidden" name="widthM" value={design.dimensions.widthM} readOnly />
    <input type="hidden" name="depthM" value={design.dimensions.depthM} readOnly />
    <input type="hidden" name="style" value={design.style} readOnly />
    <input type="hidden" name="roofMaterials" value="acrylic" readOnly />
  </div>;
}
