import { expect, it } from "vitest";
import { renderIntoDocument } from "../../../../test/reactHarness";
import StudioWorkspaceSubtotal from "./StudioWorkspaceSubtotal";
import type { WebsitePrice } from "./useStudioWebsitePrice";

it('retains the subtotal caption and exact overlap refusal through a held preview and cancellation',()=>{
 const props={houseInputNotice:null,invalid:null,invalidSelection:null,invalidJoin:false,arrangementError:'Pergola 1 and Pergola 2 have touching or overlapping conservative bounds.',products:[{},{}],price:{price:null,error:null},children:<button>Position</button>};
 const mount=renderIntoDocument(<StudioWorkspaceSubtotal {...props} provisional={false}/>);
 const caption=mount.container.querySelector('span')!;
 expect(caption.textContent).toBe('Design subtotal · including GST');
 expect(mount.container.querySelector('strong')!.textContent).toBe('Check placement');
 expect(mount.container.textContent).toContain(props.arrangementError);
 mount.rerender(<StudioWorkspaceSubtotal {...props} provisional>{null}</StudioWorkspaceSubtotal>);
 expect(mount.container.querySelector('span')).toBe(caption);
 expect(mount.container.querySelector('strong')!.textContent).toBe('Preview only');
 mount.rerender(<StudioWorkspaceSubtotal {...props} provisional={false}/>);
 expect(mount.container.querySelector('span')).toBe(caption);
 expect(mount.container.textContent).toContain(props.arrangementError);
 expect(mount.container.querySelector('button')!.textContent).toBe('Position');
 mount.unmount();
});

it("distinguishes genuine pending, terminal refusal and request failure beside the subtotal", () => {
  const props = {
    houseInputNotice: null,
    provisional: false,
    invalid: null,
    invalidSelection: null,
    invalidJoin: false,
    arrangementError: null,
    products: [{}],
    children: null,
  };
  const render = (price: WebsitePrice | null, error: string | null = null) => (
    <StudioWorkspaceSubtotal {...props} price={{ price, error }} />
  );
  const mount = renderIntoDocument(render(null));
  expect(mount.container.textContent).toContain("Calculating");
  const unavailable: WebsitePrice = {
    status: "unavailable",
    amount: null,
    requestKey: "same-design",
    reason: "Choose the site-day travel plan.",
    versionNumber: 16,
  };
  mount.rerender(render(unavailable));
  expect(mount.container.querySelector("strong")?.textContent).toBe(
    "Unavailable",
  );
  expect(mount.container.textContent).toContain(unavailable.reason);
  expect(mount.container.textContent).not.toContain("Calculating");
  mount.rerender(render(null, "Pricing request could not be completed."));
  expect(mount.container.textContent).toContain(
    "Pricing request could not be completed.",
  );
  mount.rerender(
    render({
      ...unavailable,
      status: "priced",
      amount: 1250,
      reason: undefined,
    }),
  );
  expect(mount.container.querySelector("strong")?.textContent).toContain(
    "1,250",
  );
  mount.rerender(
    <StudioWorkspaceSubtotal
      {...props}
      provisional
      price={{ price: unavailable, error: null }}
    />,
  );
  expect(mount.container.querySelector("strong")?.textContent).toBe(
    "Preview only",
  );
  mount.rerender(
    <StudioWorkspaceSubtotal
      {...props}
      invalid={{ error: "Check the selected connection." }}
      price={{ price: unavailable, error: null }}
    />,
  );
  expect(mount.container.textContent).toContain(
    "Check the selected connection.",
  );
  expect(mount.container.textContent).not.toContain(unavailable.reason);
  mount.unmount();
});
