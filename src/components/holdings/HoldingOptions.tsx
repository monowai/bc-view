import React, { ReactElement, useState } from "react";
import { useTranslation } from "next-i18next";
import Link from "next/link";
import { HideEmpty } from "@components/HideEmpty";
import { Portfolios } from "@components/Portfolios";
import { Portfolio } from "@components/types/beancounter";
import GroupByOptions from "@components/holdings/GroupByOptions";
import TrnInputForm from "@pages/trns/input";
import { useForm, Controller } from "react-hook-form";
import {useHoldingState} from "@utils/holdings/holdingState";

interface HoldingOptionsProps {
  portfolio: Portfolio;
}

export const HoldingOptions: React.FC<HoldingOptionsProps> = ({
                                                                portfolio,
                                                              }): ReactElement => {
  const { t } = useTranslation("common");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { control, handleSubmit } = useForm();
  const holdingState = useHoldingState();

  const onSubmit = (data: any) => {
    holdingState.setAsAt(data.date)
    setIsModalOpen(false);
  };

  const handleDateChange = (field: any) => (event: React.ChangeEvent<HTMLInputElement>) => {
    field.onChange(event);
    const date = new Date(event.target.value);
    if (!isNaN(date.getTime())) {
      handleSubmit(onSubmit)();
    }
  };

  return (
    <div className="filter-columns">
      <div className="filter-label">{t("option.portfolio")}</div>
      <div style={{ fontSize: "14px" }}>
        <Portfolios {...portfolio} />
      </div>
      <div className="filter-label">
        <Link href={`/portfolios/${portfolio.id}`} className="far fa-edit" />
      </div>
      <div className="filter-label">{t("holdings.groupBy")}</div>
      <div className="filter-column">
        <GroupByOptions />
      </div>
      <div className="filter-label">{t("holdings.openOnly")}</div>
      <div className="filter-column">
        <HideEmpty />
      </div>
      <div className="filter-column">
        <TrnInputForm
          portfolio={portfolio}
          isOpen={isModalOpen}
          closeModal={() => setIsModalOpen(false)}
        />
      </div>
      <div className="filter-label">{t("holdings.date")}</div>
      <div className="filter-column">
        <form onSubmit={handleSubmit(onSubmit)}>
          <Controller
            name="date"
            control={control}
            render={({ field }) => (
              <input
                {...field}
                type="date"
                defaultValue={holdingState.asAt}
                className="input is-3"
                onChange={handleDateChange(field)}
              />
            )}
          />
        </form>
      </div>
    </div>
  );
};
