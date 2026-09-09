import type { ContactDesignBrief } from './contactDesignBrief';

export default function ContactDesignSummary({ design }: { design: ContactDesignBrief }) {
  return <div className="contact-form__field--wide" aria-label="Design included with your enquiry">
    <p>{design.description}</p>
    <a href="#project-design">Edit your design ↑</a>
    <input type="hidden" name="widthM" value={design.dimensions.widthM} readOnly />
    <input type="hidden" name="depthM" value={design.dimensions.depthM} readOnly />
    <input type="hidden" name="style" value={design.style} readOnly />
    <input type="hidden" name="roofMaterials" value="acrylic" readOnly />
  </div>;
}
