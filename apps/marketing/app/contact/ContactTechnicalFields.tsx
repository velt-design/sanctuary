const pergolaForms = [
  ['pitched', 'Mono-pitched'],
  ['gable', 'Gable'],
  ['hip', 'Hip roof'],
  ['perimeter', 'Box perimeter'],
] as const;

const roofOptions = [
  ['acrylic', 'Acrylic roof'],
  ['timber', 'Solid or timber-lined roof'],
] as const;

const addOnOptions = [
  ['blinds', 'Outdoor blinds'],
  ['slats', 'Slat screens'],
  ['lighting', 'Lighting'],
  ['heating', 'Heating'],
] as const;

export default function ContactTechnicalFields() {
  return (
    <>
      <fieldset className="contact-form__subsection contact-form__field--wide">
        <legend>
          Dimensions <span>Optional</span>
        </legend>
        <div className="contact-form__dimensions">
          <label htmlFor="contact-width">
            Width
            <span>
              <input id="contact-width" name="widthM" type="number" min="1" max="10" step="0.1" inputMode="decimal" placeholder="6.0" />
              <small>metres</small>
            </span>
          </label>
          <label htmlFor="contact-depth">
            Depth
            <span>
              <input id="contact-depth" name="depthM" type="number" min="1" max="10" step="0.1" inputMode="decimal" placeholder="3.0" />
              <small>metres</small>
            </span>
          </label>
          <label htmlFor="contact-height">
            Height
            <span>
              <input id="contact-height" name="heightM" type="number" min="1.5" max="6" step="0.1" inputMode="decimal" placeholder="2.5" />
              <small>metres</small>
            </span>
          </label>
        </div>
      </fieldset>

      <div className="contact-form__field">
        <label htmlFor="contact-style">
          Pergola form <span>Optional</span>
        </label>
        <select id="contact-style" name="style" defaultValue="">
          <option value="">Not sure yet</option>
          {pergolaForms.map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="contact-form__subsection">
        <legend>
          Roof <span>Optional</span>
        </legend>
        <div className="contact-form__checks">
          {roofOptions.map(([value, label]) => (
            <label key={value}>
              <input type="checkbox" name="roofMaterials" value={value} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="contact-form__subsection contact-form__field--wide">
        <legend>
          Other options <span>Optional</span>
        </legend>
        <div className="contact-form__checks contact-form__checks--four">
          {addOnOptions.map(([value, label]) => (
            <label key={value}>
              <input type="checkbox" name="addOns" value={value} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}
