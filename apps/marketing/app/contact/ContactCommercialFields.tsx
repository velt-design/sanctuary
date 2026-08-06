import type { EnquiryAudience } from '@/lib/enquiryContext';

type BusinessAudience = Exclude<EnquiryAudience, 'residential'>;

export default function ContactCommercialFields({
  audience,
  hasAudienceError,
  onAudienceChange,
}: {
  audience: BusinessAudience | null;
  hasAudienceError: boolean;
  onAudienceChange: (audience: BusinessAudience) => void;
}) {
  return (
    <div className="contact-form__business contact-form__field--wide">
      <fieldset className="contact-form__subsection contact-form__field--wide">
        <legend>
          Who is enquiring? <span>Required</span>
        </legend>
        <div className="contact-form__checks contact-form__checks--audience">
          <label>
            <input
              id="contact-business-audience-commercial"
              type="radio"
              name="businessAudience"
              value="commercial"
              checked={audience === 'commercial'}
              required
              aria-invalid={hasAudienceError}
              onChange={() => onAudienceChange('commercial')}
            />
            <span>Organisation or venue</span>
          </label>
          <label>
            <input
              id="contact-business-audience-professional"
              type="radio"
              name="businessAudience"
              value="professional"
              checked={audience === 'professional'}
              required
              aria-invalid={hasAudienceError}
              onChange={() => onAudienceChange('professional')}
            />
            <span>Architect, designer or builder</span>
          </label>
        </div>
      </fieldset>

      <div className="contact-form__field contact-form__field--wide">
        <label htmlFor="contact-company">
          Organisation or practice <span>Optional</span>
        </label>
        <input id="contact-company" name="company" autoComplete="organization" />
      </div>

      <div className="contact-form__business-grid">
        <div className="contact-form__field">
          <label htmlFor="contact-role">
            Your role <span>Optional</span>
          </label>
          <select id="contact-role" name="projectRole" defaultValue="">
            <option value="">Select if known</option>
            <option value="owner-operator">Owner or operator</option>
            <option value="project-manager">Project manager</option>
            <option value="architect-designer">Architect or designer</option>
            <option value="builder-contractor">Builder or contractor</option>
            <option value="other">Other role</option>
          </select>
        </div>

        <div className="contact-form__field">
          <label htmlFor="contact-project-stage">
            Project stage <span>Optional</span>
          </label>
          <select id="contact-project-stage" name="projectStage" defaultValue="">
            <option value="">Select if known</option>
            <option value="feasibility">Early feasibility</option>
            <option value="concept-design">Concept or design</option>
            <option value="developed-tender">Developed design or tender</option>
            <option value="delivery">Construction or delivery</option>
          </select>
        </div>
      </div>
    </div>
  );
}
