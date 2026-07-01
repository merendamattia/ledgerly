"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssetMatrixView } from "@/components/matrix/asset-matrix-view";
import { CashflowMatrixView } from "@/components/matrix/cashflow-matrix-view";

/** Matrix hub: a top selector switching between the asset and cash-flow matrices. */
export default function MatrixPage() {
  const [view, setView] = useState("assets");

  return (
    <div className="flex flex-col gap-6">
      <Tabs value={view} onValueChange={setView}>
        <TabsList>
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="cashflow">Cash flow</TabsTrigger>
        </TabsList>
      </Tabs>

      {view === "assets" ? <AssetMatrixView /> : <CashflowMatrixView />}
    </div>
  );
}
