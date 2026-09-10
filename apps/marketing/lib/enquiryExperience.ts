
export const ENQUIRY_EXPERIENCES = {
  configured: { preheader: 'Your saved design, selected options and next steps.', label: 'Your configured pergola', subject: 'We’ve received your pergola design', intro: 'Your saved design is with our team. We’ll review the selections and how they suit your site before confirming the details and pricing.' },
  bespoke: { preheader: 'Let’s talk about your home, ideas and the right design.', label: 'Your bespoke pergola', subject: 'Let’s shape your bespoke pergola', intro: 'Thanks for telling us about your space. We’ll talk through your ideas and help shape a pergola around your home.' },
  commercial: { preheader: 'Your business brief and the next steps for your site.', label: 'Your commercial project', subject: 'Your commercial project enquiry is with us', intro: 'We’ll review your brief, site requirements and programme, then discuss the next step for your commercial project.' },
  professional: { preheader: 'Drawings, project requirements and technical coordination.', label: 'Your professional enquiry', subject: 'Your project enquiry is with our team', intro: 'Thanks for involving Sanctuary in your project. We’ll review the brief and any drawings supplied, then discuss the design information you need from us.' },
} as const;
export type EnquiryExperience = keyof typeof ENQUIRY_EXPERIENCES;
export const ENQUIRY_NEXT_STEPS = {
  configured: [
    { title: 'Review your design', description: 'We check the selected roof, dimensions and extras against your site.' },
    { title: 'Confirm the details', description: 'We’ll contact you about the connection to your home, site access and any adjustments.' },
    { title: 'Prepare your proposal', description: 'Your final design and pricing are confirmed before you commit.' },
  ],
  bespoke: [
    { title: 'Talk through your ideas', description: 'We’ll discuss how you want to use the space and what matters most to you.' },
    { title: 'Explore the right design', description: 'We consider your home, proportions, materials and the details of the site.' },
    { title: 'Agree the next step', description: 'We’ll explain what is needed to develop your design and prepare a proposal.' },
  ],
  commercial: [
    { title: 'Review your brief', description: 'We consider the proposed use, site requirements and the scope of work.' },
    { title: 'Discuss your programme', description: 'We’ll talk through timing, access and how installation would fit around your business.' },
    { title: 'Develop your proposal', description: 'We confirm the design, scope and pricing with you before work proceeds.' },
  ],
  professional: [
    { title: 'Review the project information', description: 'We read your brief and any drawings supplied, noting what still needs to be resolved.' },
    { title: 'Discuss the design requirements', description: 'We’ll talk through the roof connection, site constraints and information you need from Sanctuary.' },
    { title: 'Agree the next deliverable', description: 'Together we confirm whether you need design input, further details or a project proposal next.' },
  ],
} as const;
export type EnquiryExperienceTemplateId = `EMAIL_WEBSITE_ENQUIRY_${EnquiryExperience}_V2`;
export function experienceFromTemplate(value: string): EnquiryExperience | null {
  return (Object.keys(ENQUIRY_EXPERIENCES) as EnquiryExperience[]).find(key => value === `EMAIL_WEBSITE_ENQUIRY_${key}_V2`) ?? null;
}
