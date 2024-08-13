import React, { ReactElement, useState } from "react";
import { useTranslation } from "next-i18next";
import Link from "next/link";
import { HideEmpty } from "@components/HideEmpty";
import { Portfolios } from "@components/Portfolios";
import { Portfolio } from "@components/types/beancounter";
import GroupByOptions from "@components/holdings/GroupByOptions";
import TrnInputForm from "@pages/trns/input";
import { useForm, Controller } from "react-hook-form";
import { useHoldingState } from "@utils/holdings/holdingState";

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
    holdingState.setAsAt(data.date);
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
    <div className="columns is-align-items-flex-start">
      <div className="column is-narrow">
        <div className="field">
          <label className="label">{t("option.portfolio")}</label>
          <div className="control">
            <Portfolios {...portfolio} />
          </div>
        </div>
      </div>
      <div className="column is-narrow">
        <div className="field ">
          <div className="label hidden-value">Edit</div>
          <div className="control">
            <Link href={`/portfolios/${portfolio.id}`} className="far fa-edit"/>
          </div>
        </div>
      </div>
      <div className="column is-narrow">
        <div className="field">
          <label className="label">{t("holdings.groupBy")}</label>
          <div className="control">
            <GroupByOptions/>
          </div>
        </div>
      </div>
      <div className="column is-narrow">
        <div className="field">
          <label className="label">{t("holdings.openOnly")}</label>
          <div className="control">
            <HideEmpty/>
          </div>
        </div>
      </div>
      <div className="column is-narrow">
        <div className="field">
          <label className="label">{t("holdings.date")}</label>
          <div className="control">
            <form onSubmit={handleSubmit(onSubmit)}>
              <Controller
                name="date"
                control={control}
                render={({field}) => (
                  <input
                    {...field}
                    type="date"
                    defaultValue={holdingState.asAt}
                    className="input"
                    onChange={handleDateChange(field)}
                  />
                )}
              />
            </form>
          </div>
        </div>
      </div>
      <div className="column is-narrow">
        <div className="field">
          <div className="label hidden-value">x</div>
          <div className="control">
            <TrnInputForm
              portfolio={portfolio}
              isOpen={isModalOpen}
              closeModal={() => setIsModalOpen(false)}
            />
          </div>
        </div>
      </div>

    </div>
  );
};
