import type { SiteInputsV1 } from '@sp/costing';

/** Optional staff job inputs. The public configurator keeps its established defaults. */
export type ConfiguratorCommercialOptions = {
  site?: Omit<SiteInputsV1, 'pergolas'>;
  access?: 'easy' | 'normal' | 'hard';
  height?: 'single_storey' | 'two_storey';
};

export function applyConfiguratorCommercialOptions(site: SiteInputsV1, options?: ConfiguratorCommercialOptions): SiteInputsV1 {
  if (!options) return site;
  return {
    ...site, ...options.site,
    pergolas: site.pergolas.map(pergola => ({ ...pergola, modules: pergola.modules.map(module => ({
      ...module, ...(options.access ? { access: options.access } : {}), ...(options.height ? { height: options.height } : {}),
    })) })),
  };
}
