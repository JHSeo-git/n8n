<script setup lang="ts">
import WorkflowDetails from '@/components/MainHeader/WorkflowDetails.vue';
import { useI18n } from '@/composables/useI18n';
import { usePushConnection } from '@/composables/usePushConnection';
import {
	LOCAL_STORAGE_HIDE_GITHUB_STAR_BUTTON,
	MAIN_HEADER_TABS,
	PLACEHOLDER_EMPTY_WORKFLOW_ID,
	STICKY_NODE_TYPE,
	VIEWS,
	WORKFLOW_EVALUATION_EXPERIMENT,
} from '@/constants';
import { useExecutionsStore } from '@/stores/executions.store';
import { useNDVStore } from '@/stores/ndv.store';
import { usePostHog } from '@/stores/posthog.store';
import { useSettingsStore } from '@/stores/settings.store';
import { useSourceControlStore } from '@/stores/sourceControl.store';
import { useUIStore } from '@/stores/ui.store';
import { useWorkflowsStore } from '@/stores/workflows.store';
import { computed, onBeforeMount, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { RouteLocation, RouteLocationRaw } from 'vue-router';
import { useRoute, useRouter } from 'vue-router';

import { useLocalStorage } from '@vueuse/core';
import { useCanvasOperations } from '@/composables/useCanvasOperations';

const router = useRouter();
const route = useRoute();
const locale = useI18n();
const pushConnection = usePushConnection({ router });
const ndvStore = useNDVStore();
const uiStore = useUIStore();
const sourceControlStore = useSourceControlStore();
const workflowsStore = useWorkflowsStore();
const executionsStore = useExecutionsStore();
const settingsStore = useSettingsStore();
const posthogStore = usePostHog();
const { addNodes } = useCanvasOperations({ router });

const activeHeaderTab = ref(MAIN_HEADER_TABS.WORKFLOW);
const workflowToReturnTo = ref('');
const executionToReturnTo = ref('');
const dirtyState = ref(false);
const githubButtonHidden = useLocalStorage(LOCAL_STORAGE_HIDE_GITHUB_STAR_BUTTON, false);

// Track the routes that are used for the tabs
// This is used to determine which tab to show when the route changes
// TODO: It might be easier to manage this in the router config, by passing meta information to the routes
// This would allow us to specify it just once on the root route, and then have the tabs be determined for children
const testDefinitionRoutes: VIEWS[] = [
	VIEWS.TEST_DEFINITION,
	VIEWS.TEST_DEFINITION_EDIT,
	VIEWS.TEST_DEFINITION_RUNS_DETAIL,
	VIEWS.TEST_DEFINITION_RUNS_COMPARE,
];

const workflowRoutes: VIEWS[] = [VIEWS.WORKFLOW, VIEWS.NEW_WORKFLOW, VIEWS.EXECUTION_DEBUG];

const executionRoutes: VIEWS[] = [
	VIEWS.EXECUTION_HOME,
	VIEWS.WORKFLOW_EXECUTIONS,
	VIEWS.EXECUTION_PREVIEW,
];
const tabBarItems = computed(() => {
	const items = [
		{ value: MAIN_HEADER_TABS.WORKFLOW, label: locale.baseText('generic.editor') },
		{ value: MAIN_HEADER_TABS.EXECUTIONS, label: locale.baseText('generic.executions') },
	];

	if (posthogStore.isFeatureEnabled(WORKFLOW_EVALUATION_EXPERIMENT)) {
		items.push({
			value: MAIN_HEADER_TABS.TEST_DEFINITION,
			label: locale.baseText('generic.tests'),
		});
	}
	return items;
});

const activeNode = computed(() => ndvStore.activeNode);
const hideMenuBar = computed(() =>
	Boolean(activeNode.value && activeNode.value.type !== STICKY_NODE_TYPE),
);
const workflow = computed(() => workflowsStore.workflow);
const workflowId = computed(() =>
	String(router.currentRoute.value.params.name || workflowsStore.workflowId),
);
const onWorkflowPage = computed(() => !!(route.meta.nodeView || route.meta.keepWorkflowAlive));
const readOnly = computed(() => sourceControlStore.preferences.branchReadOnly);
const isEnterprise = computed(
	() => settingsStore.isQueueModeEnabled && settingsStore.isWorkerViewAvailable,
);

watch(route, (to, from) => {
	syncTabsWithRoute(to, from);
});

onBeforeMount(() => {
	pushConnection.initialize();
});

onBeforeUnmount(() => {
	pushConnection.terminate();
});

onMounted(async () => {
	dirtyState.value = uiStore.stateIsDirty;
	syncTabsWithRoute(route);
});

function isViewRoute(name: unknown): name is VIEWS {
	return (
		typeof name === 'string' &&
		[testDefinitionRoutes, workflowRoutes, executionRoutes].flat().includes(name as VIEWS)
	);
}

function syncTabsWithRoute(to: RouteLocation, from?: RouteLocation): void {
	// Map route types to their corresponding tab in the header
	const routeTabMapping = [
		{ routes: testDefinitionRoutes, tab: MAIN_HEADER_TABS.TEST_DEFINITION },
		{ routes: executionRoutes, tab: MAIN_HEADER_TABS.EXECUTIONS },
		{ routes: workflowRoutes, tab: MAIN_HEADER_TABS.WORKFLOW },
	];

	// Update the active tab based on the current route
	if (to.name && isViewRoute(to.name)) {
		const matchingTab = routeTabMapping.find(({ routes }) => routes.includes(to.name as VIEWS));
		if (matchingTab) {
			activeHeaderTab.value = matchingTab.tab;
		}
	}

	// Store the current workflow ID, but only if it's not a new workflow
	if (to.params.name !== 'new' && typeof to.params.name === 'string') {
		workflowToReturnTo.value = to.params.name;
	}

	if (
		from?.name === VIEWS.EXECUTION_PREVIEW &&
		to.params.name === from.params.name &&
		typeof from.params.executionId === 'string'
	) {
		executionToReturnTo.value = from.params.executionId;
	}
}

function onTabSelected(tab: MAIN_HEADER_TABS, event: MouseEvent) {
	const openInNewTab = event.ctrlKey || event.metaKey;

	switch (tab) {
		case MAIN_HEADER_TABS.WORKFLOW:
			void navigateToWorkflowView(openInNewTab);
			break;

		case MAIN_HEADER_TABS.EXECUTIONS:
			void navigateToExecutionsView(openInNewTab);
			break;

		case MAIN_HEADER_TABS.TEST_DEFINITION:
			activeHeaderTab.value = MAIN_HEADER_TABS.TEST_DEFINITION;
			void router.push({ name: VIEWS.TEST_DEFINITION });
			break;

		default:
			break;
	}
}

async function navigateToWorkflowView(openInNewTab: boolean) {
	let routeToNavigateTo: RouteLocationRaw;
	if (!['', 'new', PLACEHOLDER_EMPTY_WORKFLOW_ID].includes(workflowToReturnTo.value)) {
		routeToNavigateTo = {
			name: VIEWS.WORKFLOW,
			params: { name: workflowToReturnTo.value },
		};
	} else {
		routeToNavigateTo = { name: VIEWS.NEW_WORKFLOW };
	}

	if (openInNewTab) {
		const { href } = router.resolve(routeToNavigateTo);
		window.open(href, '_blank');
	} else if (route.name !== routeToNavigateTo.name) {
		if (route.name === VIEWS.NEW_WORKFLOW) {
			uiStore.stateIsDirty = dirtyState.value;
		}
		activeHeaderTab.value = MAIN_HEADER_TABS.WORKFLOW;
		await router.push(routeToNavigateTo);
	}
}

async function navigateToExecutionsView(openInNewTab: boolean) {
	const routeWorkflowId =
		workflowId.value === PLACEHOLDER_EMPTY_WORKFLOW_ID ? 'new' : workflowId.value;
	const executionToReturnToValue = executionsStore.activeExecution?.id || executionToReturnTo.value;
	const routeToNavigateTo: RouteLocationRaw = executionToReturnToValue
		? {
				name: VIEWS.EXECUTION_PREVIEW,
				params: { name: routeWorkflowId, executionId: executionToReturnToValue },
			}
		: {
				name: VIEWS.EXECUTION_HOME,
				params: { name: routeWorkflowId },
			};

	if (openInNewTab) {
		const { href } = router.resolve(routeToNavigateTo);
		window.open(href, '_blank');
	} else if (route.name !== routeToNavigateTo.name) {
		dirtyState.value = uiStore.stateIsDirty;
		workflowToReturnTo.value = workflowId.value;
		activeHeaderTab.value = MAIN_HEADER_TABS.EXECUTIONS;
		await router.push(routeToNavigateTo);
	}
}

function hideGithubButton() {
	githubButtonHidden.value = true;
}

function addAgentNode() {
	// 예시: KnowledgeBasedRequestDTO 기반 파라미터 세팅
	void addNodes([
		{
			type: 'n8n-nodes-base.httpRequest',
			name: 'Agent HTTP Request',
			parameters: {
				requestMethod: 'POST',
				url: 'http://refer-aipg-user-backend/playground/generation/knowledge-based/execute-stream',
				jsonParameters: true,
				sendBody: true,
				options: {},
				bodyParametersJson: JSON.stringify({
					user_id: '',
					question: '',
					generationPrompt: '',
					reference: '',
					index_name: '',
					gpt_version: 'gpt4',
					prompt: '',
					max_tokens: 2048,
					top_k: 3,
					search_method: 'hybrid',
					parameters: '',
				}),
			},
			position: [480, 120],
		},
	]);
}

function addPromptNode() {
	// 예시: PromptCreateRequestDTO 기반 파라미터 세팅
	void addNodes([
		{
			type: 'n8n-nodes-base.httpRequest',
			name: 'Prompt HTTP Request',
			parameters: {
				requestMethod: 'POST',
				url: 'http://refer-aipg-user-backend/prompt/create',
				jsonParameters: true,
				sendBody: true,
				options: {},
				bodyParametersJson: JSON.stringify({
					promptSeq: null,
					title: '',
					description: '',
					promptContent: '',
					promptTagSeqs: [],
					saveStatus: '',
					deleted: 0,
					isPublic: 1,
					version: 1,
				}),
			},
			position: [600, 120],
		},
	]);
}
</script>

<template>
	<div :class="$style.container">
		<div
			:class="{ [$style['main-header']]: true, [$style.expanded]: !uiStore.sidebarMenuCollapsed }"
		>
			<div v-show="!hideMenuBar" :class="$style['top-menu']">
				<WorkflowDetails
					v-if="workflow?.name"
					:id="workflow.id"
					:tags="workflow.tags"
					:name="workflow.name"
					:meta="workflow.meta"
					:scopes="workflow.scopes"
					:active="workflow.active"
					:read-only="readOnly"
				/>
			</div>
			<div style="display: flex; align-items: center; margin-bottom: 18px">
				<div style="display: flex; align-items: center; gap: 12px; margin-left: 16px">
					<button
						class="$style.add-action-btn"
						@click="addAgentNode"
						title="에이전트 노드 추가"
						style="
							background: linear-gradient(90deg, #6a5af9 0%, #8f6ed5 100%);
							color: #fff;
							border-radius: 999px;
							border: none;
							font-size: 17px;
							font-weight: 700;
							height: 36px;
							padding: 0 22px;
							box-shadow: none;
							letter-spacing: 1px;
							cursor: pointer;
						"
					>
						Agent
					</button>
					<button
						class="$style.add-action-btn"
						@click="addPromptNode"
						title="프롬프트 노드 추가"
						style="
							background: linear-gradient(90deg, #6a5af9 0%, #8f6ed5 100%);
							color: #fff;
							border-radius: 999px;
							border: none;
							font-size: 17px;
							font-weight: 700;
							height: 36px;
							padding: 0 22px;
							box-shadow: none;
							letter-spacing: 1px;
							cursor: pointer;
						"
					>
						Prompt
					</button>
				</div>
			</div>
		</div>
	</div>
</template>

<style module lang="scss">
.container {
	width: 100%;
	z-index: 1000;
}

.main-header {
	min-height: var(--navbar--height);
	background-color: var(--color-background-xlight);
	width: 100%;
	box-sizing: border-box;
	border-bottom: var(--border-width-base) var(--border-style-base) var(--color-foreground-base);
}

.top-menu {
	position: relative;
	display: flex;
	align-items: center;
	font-size: 0.9em;
	font-weight: var(--font-weight-regular);
	overflow: auto;
}

.github-button {
	display: flex;
	align-items: center;
	align-self: stretch;
	padding: var(--spacing-5xs) var(--spacing-m) 0;
	background-color: var(--color-background-xlight);
	border-left: var(--border-width-base) var(--border-style-base) var(--color-foreground-base);
}

.close-github-button {
	display: none;
	position: absolute;
	right: 0;
	top: 0;
	transform: translate(50%, -46%);
	color: var(--color-foreground-xdark);
	background-color: var(--color-background-xlight);
	border-radius: 100%;
	cursor: pointer;

	&:hover {
		color: var(--prim-color-primary-shade-100);
	}
}
.github-button-container {
	position: relative;
}

.github-button:hover .close-github-button {
	display: block;
}

:global(.add-action-btn) {
	display: flex;
	align-items: center;
	justify-content: center;
	width: auto;
	height: 44px;
	padding: 0 32px;
	margin: 0 12px 0 0;
	border: none !important;
	background: linear-gradient(90deg, #6a5af9 0%, #8f6ed5 100%) !important;
	color: #fff !important;
	border-radius: 999px !important;
	font-size: 20px !important;
	font-weight: 700 !important;
	letter-spacing: 1px;
	box-shadow: none !important;
	cursor: pointer;
	transition:
		background 0.2s,
		filter 0.2s;

	&:hover {
		filter: brightness(1.08);
	}
	&:active {
		filter: brightness(0.95);
	}
}
</style>
