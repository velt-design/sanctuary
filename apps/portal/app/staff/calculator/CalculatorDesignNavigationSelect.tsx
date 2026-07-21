import type { CalculatorDesignNavigation } from './calculatorWorkspace';

export default function CalculatorDesignNavigationSelect({
  navigation,
  className,
}: {
  navigation: CalculatorDesignNavigation;
  className?: string;
}) {
  return (
    <label>
      <span className="sr-only">Design version</span>
      <select
        className={className}
        aria-label="Design version"
        value={navigation.value}
        onChange={(event) => navigation.onChange(event.target.value)}
      >
        {navigation.options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}
