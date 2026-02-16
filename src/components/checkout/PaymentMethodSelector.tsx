import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface PaymentMethod {
  id: string;
  name: string;
  description: string;
  logo?: string;
  isAvailable: boolean;
}

interface PaymentMethodSelectorProps {
  onSelect: (method: string) => void;
  selected: string;
}

export default function PaymentMethodSelector({
  onSelect,
  selected,
}: PaymentMethodSelectorProps) {
  const paymentMethods: PaymentMethod[] = [
    {
      id: "stripe",
      name: "Credit/Debit Card",
      description: "Pay securely with Visa, Mastercard, or other major credit cards.",
      logo: "/payment-icons/cards.svg",
      isAvailable: true,
    },
    {
      id: "mpesa",
      name: "M-Pesa",
      description: "Pay directly with M-Pesa mobile money.",
      logo: "/payment-icons/mpesa.svg",
      isAvailable: true,
    }
  ];

  const handleSelect = (methodId: string) => {
    const method = paymentMethods.find(m => m.id === methodId);
    if (method && method.isAvailable) {
      onSelect(methodId);
    }
  };

  return (
    <RadioGroup
      value={selected}
      onValueChange={handleSelect}
      className="space-y-3"
    >
      {paymentMethods.map((method) => (
        <div
          key={method.id}
          className={`flex items-center space-x-3 rounded-lg border p-4 transition-colors ${
            selected === method.id
              ? "border-blue-600 bg-blue-50"
              : method.isAvailable
                ? "cursor-pointer hover:border-gray-300"
                : "cursor-not-allowed opacity-60"
          }`}
          onClick={() => method.isAvailable && handleSelect(method.id)}
        >
          <RadioGroupItem
            value={method.id}
            id={`payment-${method.id}`}
            disabled={!method.isAvailable}
            className="data-[state=checked]:border-blue-600"
          />
          <Label
            htmlFor={`payment-${method.id}`}
            className="flex flex-1 cursor-pointer items-center justify-between"
          >
            <div className="space-y-1">
              <p className="font-medium">{method.name}</p>
              <p className="text-sm text-gray-500">{method.description}</p>
            </div>
            {method.logo && (
              <div className="ml-4 h-10 w-16 shrink-0">
                {/* Display payment method logo if available */}
                {method.id === "stripe" && (
                  <div className="flex gap-1">
                    <svg viewBox="0 0 24 24" className="h-6 w-6">
                      <path
                        d="M9.5 5.5h5c.8 0 1.5.3 2 .9.5.5.8 1.3.8 2.1 0 1.5-.9 2.6-2.3 3v.1c1.8.3 3.1 1.6 3.1 3.4 0 1.1-.4 2-1.1 2.6-.7.6-1.8 1-3 1h-4.5v-13Zm2 5h2.4c1 0 1.6-.6 1.6-1.5S14.9 7.5 13.9 7.5h-2.4v3Zm0 6h3c1.2 0 1.8-.6 1.8-1.6 0-1-.6-1.6-1.8-1.6h-3v3.2Z"
                        fill="#3D71D9"
                      />
                    </svg>
                    <svg viewBox="0 0 24 24" className="h-6 w-6">
                      <path
                        d="M15.5 15.5h-7A4.5 4.5 0 0 1 4 11a4.5 4.5 0 0 1 4.5-4.5h7A4.5 4.5 0 0 1 20 11a4.5 4.5 0 0 1-4.5 4.5Zm-7-7C7.1 8.5 6 9.6 6 11s1.1 2.5 2.5 2.5h7c1.4 0 2.5-1.1 2.5-2.5S16.9 8.5 15.5 8.5h-7Z"
                        fill="#EB2226"
                      />
                    </svg>
                    <svg viewBox="0 0 24 24" className="h-6 w-6">
                      <path
                        d="m9 9.5 3 5 3-5"
                        stroke="#F99F1B"
                        strokeWidth="2"
                        fill="none"
                      />
                    </svg>
                  </div>
                )}
                {method.id === "mpesa" && (
                  <div className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded flex items-center justify-center">
                    M-PESA
                  </div>
                )}
              </div>
            )}
          </Label>
        </div>
      ))}
    </RadioGroup>
  );
}
