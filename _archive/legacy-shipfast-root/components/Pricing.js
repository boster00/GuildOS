import Link from "next/link";
import { Coins } from "lucide-react";
import config from "@/config";
import ButtonCheckout from "./ButtonCheckout";
import { PLAN_DISPLAY, getDisplay, getPlanFeatureList } from "@/libs/planDisplay";

// <Pricing/> displays the pricing plans: free trial + plans from config.stripe.plans.
// All copy/claims come from @/libs/planDisplay (same as /billing/subscriptions).

const CheckIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className="w-[18px] h-[18px] opacity-80 shrink-0"
  >
    <path
      fillRule="evenodd"
      d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
      clipRule="evenodd"
    />
  </svg>
);

const Pricing = ({ variant = "default" }) => {
  const { freeTrial, plans } = config.stripe;
  const isPublic = variant === "public";

  const freeDisplay = PLAN_DISPLAY.free;
  const freeFeatureList = getPlanFeatureList(freeDisplay);

  return (
    <section className="bg-base-200 overflow-hidden" id="pricing">
      <div className="py-24 px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex flex-col text-center w-full mb-20">
          <p className="font-medium text-primary mb-8">Pricing</p>
          <h2 className="font-bold text-3xl lg:text-5xl tracking-tight">
            Start free. Then choose the plan that fits.
          </h2>
          <p className="text-lg text-base-content/80 mt-4 max-w-2xl mx-auto">
            {freeTrial
              ? "No time limit on free. Then choose Starter or Pro when you're ready."
              : "Choose the plan that fits your team."}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {/* Free Trial card — copy from planDisplay (same as /billing/subscriptions) */}
          {freeTrial && (
            <div className="relative w-full flex flex-col">
              <div className="flex flex-col h-full gap-5 lg:gap-8 bg-base-100 p-8 rounded-lg border border-base-300">
                <div>
                  <p className="text-lg lg:text-xl font-bold">{freeDisplay.name}</p>
                  <p className="text-base-content/80 mt-2 flex items-center gap-1.5 flex-wrap">
                    <Coins className="w-4 h-4 shrink-0" aria-hidden />
                    {freeDisplay.includedUsage}. No time limit. No credit card required.
                  </p>
                </div>
                <div className="flex gap-2 items-baseline">
                  <p className="text-5xl tracking-tight font-extrabold">${freeDisplay.monthlyPrice}</p>
                </div>
                <ul className="space-y-2.5 leading-relaxed text-base flex-1">
                  {freeFeatureList.map((text, i) => (
                    <li key={i} className="flex items-center gap-2">
                      {/credit/i.test(text) ? <Coins className="w-4 h-4 shrink-0 text-primary" aria-hidden /> : <CheckIcon />}
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
                <div className="space-y-2 mt-auto">
                  <Link
                    href={config.auth?.loginUrl || "/signin"}
                    className="btn btn-outline btn-block"
                  >
                    Start free
                  </Link>
                  <p className="text-center text-sm text-base-content/60">
                    No card required
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Paid plan cards — name, price, description, and features from planDisplay */}
          {plans.map((plan) => {
            const tierId = plan.name?.toLowerCase();
            const display = getDisplay(tierId);
            const featureList = getPlanFeatureList(display);
            return (
              <div key={plan.priceId} className="relative w-full flex flex-col">
                {plan.isFeatured && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                    <span className="badge text-xs text-primary-content font-semibold border-0 bg-primary">
                      POPULAR
                    </span>
                  </div>
                )}
                {plan.isFeatured && (
                  <div className="absolute -inset-[1px] rounded-[9px] bg-primary z-10" />
                )}
                <div className="relative flex flex-col h-full gap-5 lg:gap-8 z-10 bg-base-100 p-8 rounded-lg">
                  <div>
                    <p className="text-lg lg:text-xl font-bold">{display.name}</p>
                    <p className="text-base-content/80 mt-2">{display.bestFor}</p>
                  </div>
                  <div className="flex gap-2 items-baseline">
                    <p className="text-5xl tracking-tight font-extrabold">
                      ${display.monthlyPrice}
                      <span className="text-lg font-normal text-base-content/80"> / month</span>
                    </p>
                  </div>
                  <ul className="space-y-2.5 leading-relaxed text-base flex-1">
                    {featureList.map((text, i) => (
                      <li key={i} className="flex items-center gap-2">
                        {/credit/i.test(text) ? <Coins className="w-4 h-4 shrink-0 text-primary" aria-hidden /> : <CheckIcon />}
                        <span>{text}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="space-y-2 mt-auto">
                    {isPublic ? (
                      <>
                        <Link
                          href={config.auth?.loginUrl || "/signin"}
                          className="btn btn-primary btn-block"
                        >
                          Register a free account first
                        </Link>
                        <p className="text-center text-sm text-base-content/60">
                          You can upgrade your plan inside the app.
                        </p>
                      </>
                    ) : (
                      <>
                        <ButtonCheckout priceId={plan.priceId} />
                        <p className="text-center text-sm text-base-content/60">
                          Subscribe · Cancel anytime
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Pricing;
