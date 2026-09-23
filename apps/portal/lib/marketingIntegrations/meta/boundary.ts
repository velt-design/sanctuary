export type Step = 'identity_check' | 'account_read' | 'report_read';
export type Boundary = <T>(step: Step, execute: () => Promise<T>, before?: object, after?: (result: T) => object) => Promise<T>;
