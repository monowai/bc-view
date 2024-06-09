import React from "react";
import { Controller } from "react-hook-form";
import Select from "react-select";

interface SelectControllerProps {
  name: string;
  control: any;
  options: { value: string; label: string }[];
}

const TradeTypeController: React.FC<SelectControllerProps> = ({
  name,
  control,
  options,
}) => {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <Select {...field} defaultValue={options[0]} options={options} />
      )}
    />
  );
};

export default TradeTypeController;
