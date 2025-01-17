import { t, Trans } from "@lingui/macro";
import * as Collapsible from "@radix-ui/react-collapsible";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Copy,
  Folder,
  FolderOpen,
  Plus,
  Sparkle,
  Trash,
  X,
} from "phosphor-react";
import { memo, ReactNode, useContext, useReducer, useState } from "react";
import { useMutation } from "react-query";
import { Link, useNavigate } from "react-router-dom";

import { AppContext } from "../components/AppContext";
import Loading from "../components/Loading";
import { LOCAL_STORAGE_SETTINGS_KEY } from "../lib/constants";
import { titleToLocalStorageKey } from "../lib/helpers";
import { useIsProUser } from "../lib/hooks";
import {
  copyHostedChartById,
  deleteChart,
  queryClient,
  useHostedCharts,
} from "../lib/queries";
import { useLastChart } from "../lib/useLastChart";
import { Overlay } from "../ui/Dialog";
import { Button2, Page } from "../ui/Shared";
import { Description, PageTitle, SectionTitle } from "../ui/Typography";
// Keep these in sync (55px)
const leftColumnGrid = "grid-cols-[55px_minmax(0,1fr)]";
const leftMargin = "sm:ml-[55px]";

export default function Charts() {
  const isProUser = useIsProUser();
  const customerIsLoading = useContext(AppContext).customerIsLoading;
  // write a charts reducer where the dispatch just refetches charts
  const [temporaryCharts, refetchTemporaryCharts] = useReducer(
    getTemporaryCharts,
    getTemporaryCharts()
  );
  const { data: persistentCharts, isLoading } = useHostedCharts();
  const isLoadingAnything = isLoading || customerIsLoading;
  const navigate = useNavigate();
  const currentChart = useLastChart((state) => state.lastChart);
  const handleDeleteChart = useMutation("deleteChart", deleteChart, {
    onSuccess: (_result, args) => {
      queryClient.invalidateQueries(["auth", "hostedCharts"]);

      // set the root chart as the active one
      useLastChart.setState({ lastChart: "" });

      // remove the deleted chart from reactQuery
      queryClient.removeQueries(["useHostedDoc", args.chartId]);
    },
    onMutate: async (args) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries(["auth", "hostedCharts"]);

      const previousHostedCharts = queryClient.getQueryData([
        "auth",
        "hostedCharts",
      ]);

      // Optimistically update to the new value
      queryClient.setQueryData(["auth", "hostedCharts"], (old: any) => {
        return old.filter((chart: any) => chart.id !== args.chartId);
      });

      // Return a context object with the snapshotted value
      return { previousHostedCharts };
    },
    onError: (_err, _args, context) => {
      queryClient.setQueryData(
        ["auth", "hostedCharts"],
        context?.previousHostedCharts
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries(["auth", "hostedCharts"]);
    },
  });
  const handleCopyPersistentChart = useMutation(
    "copyPersistentChart",
    copyHostedChartById,
    {
      onSuccess: (result) => {
        queryClient.invalidateQueries(["auth", "hostedCharts"]);
        if (result && result.id) navigate(`/u/${result.id}`);
      },
    }
  );
  return (
    <Page>
      <header className="flex items-center justify-center gap-6">
        <PageTitle>
          <Trans>Your Charts</Trans>
        </PageTitle>
        <Button2
          leftIcon={<Plus size={16} />}
          onClick={() => navigate("/n")}
          color="blue"
        >
          <Trans>New</Trans>
        </Button2>
      </header>
      <section className="grid gap-12">
        <LargeFolder
          title={t`Permanent Flowcharts`}
          description={
            <Trans>
              Access these charts from anywhere.
              <br />
              Share and embed flowcharts that stay in sync.
            </Trans>
          }
        >
          {isLoadingAnything ? (
            <div className="py-4">
              <Loading />
            </div>
          ) : isProUser ? (
            <div className="grid gap-1">
              {persistentCharts?.map((chart) => (
                <ChartLink
                  key={chart.id}
                  title={chart.name}
                  href={`/u/${chart.id}`}
                  handleDelete={() => {
                    handleDeleteChart.mutate({ chartId: chart.id });
                  }}
                  handleCopy={() => {
                    handleCopyPersistentChart.mutate(chart.id);
                  }}
                  isCurrent={`/u/${chart.id}` === currentChart}
                >
                  <div className="flex items-center gap-4 text-xs text-foreground/50 dark:text-background/50">
                    <span>{chart.niceCreatedDate}</span>
                    <span>{chart.niceUpdatedDate}</span>
                  </div>
                </ChartLink>
              ))}
            </div>
          ) : (
            <ProFeatureLink />
          )}
        </LargeFolder>

        <LargeFolder
          title={t`Temporary Flowcharts`}
          description={
            <Trans>
              Only available on this device.
              <br />
              Clearing your browser cache will erase them.
            </Trans>
          }
        >
          <div className="grid gap-1">
            {temporaryCharts.map((chart) => (
              <ChartLink
                key={chart}
                title={`/${chart}`}
                href={`/${chart}`}
                handleDelete={() => {
                  deleteLocalChart(chart, currentChart || "", navigate);
                  refetchTemporaryCharts();
                }}
                handleCopy={() => {
                  copyLocalChart(chart, navigate);
                }}
                isCurrent={`/${chart}` === currentChart}
              />
            ))}
          </div>
        </LargeFolder>
      </section>
    </Page>
  );
}

const LargeFolder = memo(function LargeFolder({
  title,
  description = null,
  children,
}: {
  title: string;
  description: ReactNode;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <Collapsible.Root open={isOpen} onOpenChange={setIsOpen}>
      <section className="grid gap-4 md:-ml-[55px]">
        <Collapsible.Trigger asChild>
          <button
            className={`grid grid-auto-cols items-start text-left w-full ${leftColumnGrid} focus:shadow-none`}
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? (
              <FolderOpen size={36} weight="light" />
            ) : (
              <Folder size={36} weight="light" />
            )}
            <div className="grid gap-1">
              <SectionTitle className="mt-[4px]">{title}</SectionTitle>
              {description ? <Description>{description}</Description> : null}
            </div>
          </button>
        </Collapsible.Trigger>
        <Collapsible.Content>
          <List>{children}</List>
        </Collapsible.Content>
      </section>
    </Collapsible.Root>
  );
});

const List = memo(function List({ children }: { children: ReactNode }) {
  return <div className={`grid gap-4 ${leftMargin}`}>{children}</div>;
});

function getTemporaryCharts() {
  return [""]
    .concat(
      Object.keys(window.localStorage)
        .filter(
          (key) =>
            key.indexOf("flowcharts.fun:") === 0 &&
            key !== LOCAL_STORAGE_SETTINGS_KEY
        )
        .map((file) => file.split(":")[1])
    )
    .sort();
}

const ChartLink = memo(function ChartLink({
  title,
  href,
  children = null,
  handleDelete,
  handleCopy,
  isCurrent = false,
}: {
  title: string;
  href: string;
  children?: ReactNode;
  handleDelete?: () => void;
  handleCopy?: () => void;
  isCurrent?: boolean;
}) {
  return (
    <div
      className={`chart-link border dark:border-neutral-700 rounded grid grid-flow-col grid-cols-[minmax(0,1fr)_auto] items-center ${
        isCurrent ? "bg-blue-50 dark:bg-blue-900" : ""
      }`}
    >
      <Link to={href} className="py-3 px-4">
        <div className="grid gap-2">
          <span
            className={`text-base ${
              isCurrent ? "text-blue-600 dark:text-blue-50" : ""
            }`}
          >
            {title}
          </span>
          {children}
        </div>
      </Link>
      <div className="p-2 pr-2 flex items-center">
        <button
          className="opacity-25 sm:opacity-50 hover:opacity-100 rounded transition-opacity p-1 focus:shadow-none focus:bg-neutral-300/25"
          aria-label={`Copy flowchart: ${title}`}
          onClick={handleCopy}
        >
          <Copy size={20} />
        </button>
        <Dialog.Root>
          <Dialog.Trigger asChild>
            <button
              className="opacity-25 sm:opacity-50 hover:opacity-100 rounded transition-opacity p-1 focus:shadow-none focus:bg-neutral-300/25"
              aria-label={`Delete flowchart: ${title}`}
            >
              <Trash size={20} />
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Overlay />
            <Dialog.Content className="data-[state=open]:animate-contentShow bg-background text-foreground dark:bg-foreground dark:text-background fixed top-[50%] left-[50%] max-h-[85vh] w-[90vw] max-w-[400px] translate-x-[-50%] translate-y-[-50%] rounded-lg bg-background p-4 shadow-lg focus:outline-none z-50 grid gap-3">
              <Dialog.Title className="text-lg font-bold">
                <Trans>Do you want to delete this?</Trans>
              </Dialog.Title>
              <Dialog.Description>
                <Trans>This action cannot be undone.</Trans>
              </Dialog.Description>
              <div className="flex gap-2 mt-6 justify-self-end">
                <Dialog.Close asChild>
                  <Button2 leftIcon={<X size={16} />}>Cancel</Button2>
                </Dialog.Close>
                <Dialog.Close asChild>
                  <Button2
                    leftIcon={<Trash size={16} />}
                    color="red"
                    onClick={handleDelete}
                  >
                    Delete
                  </Button2>
                </Dialog.Close>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </div>
  );
});

function deleteLocalChart(
  chartId: string,
  currentChart: string,
  navigate: (path: string) => void
) {
  // if on this path, move to index
  if (currentChart === chartId && currentChart !== "") {
    navigate("/");
  }
  window.localStorage.removeItem(titleToLocalStorageKey(chartId));
}

function copyLocalChart(chart: string, navigate: (path: string) => void) {
  let i = 1;
  let name = chart || "Untitled";
  let copy = `${name}-${i}`;
  while (window.localStorage.getItem(titleToLocalStorageKey(copy))) {
    i++;
    copy = `${name}-${i}`;
  }
  // copy in localStorage
  const data = window.localStorage.getItem(titleToLocalStorageKey(chart));
  window.localStorage.setItem(titleToLocalStorageKey(copy), data ?? "");
  navigate(`/${copy}`);
}

function ProFeatureLink() {
  return (
    <div
      className={`flex items-center p-4 pt-[15px] gap-3 rounded-lg text-sm bg-neutral-200 rounded-lg dark:bg-neutral-900`}
    >
      <div className="w-[47px] sm:w-auto">
        <Sparkle
          size={30}
          className="text-blue-500 translate-y-[-1px] dark:text-orange-500"
        />
      </div>
      <div className="grid w-full gap-1 items-start">
        <span>
          <Trans>Permanent Charts are a Pro Feature</Trans>
        </span>
        <Link
          to="/pricing"
          className="text-blue-500 dark:text-orange-500"
          data-testid="to-pricing"
        >
          <Trans>Learn about Flowchart Fun Pro</Trans>
        </Link>
      </div>
    </div>
  );
}
