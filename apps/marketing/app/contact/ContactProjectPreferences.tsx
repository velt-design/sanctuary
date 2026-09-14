'use client';
import { useState } from 'react';

export default function ContactProjectPreferences({ showBudget }: { showBudget: boolean }) {
  const [hasBudget, setHasBudget] = useState(false);
  return <>
    <div className="contact-form__field contact-form__field--wide">
      <label htmlFor="contact-timing">Preferred timing <span>Optional</span></label>
      <input id="contact-timing" name="preferredTiming" maxLength={160} placeholder="A preferred season or date, or no fixed timing" />
    </div>
    {showBudget && <div className="contact-form__field contact-form__field--wide">
      <label htmlFor="contact-budget-choice">Budget <span>Optional</span></label>
      <select id="contact-budget-choice" name="budgetPreference" value={hasBudget ? 'provided' : 'not-sure'} onChange={event => setHasBudget(event.target.value === 'provided')}>
        <option value="not-sure">Not sure yet</option>
        <option value="provided">I have a budget in mind</option>
      </select>
      {hasBudget && <>
        <label htmlFor="contact-budget">Your approximate budget <span>Optional</span></label>
        <input id="contact-budget" name="budgetHint" maxLength={160} placeholder="Amount or range in NZD, including GST" />
      </>}
    </div>}
  </>;
}
