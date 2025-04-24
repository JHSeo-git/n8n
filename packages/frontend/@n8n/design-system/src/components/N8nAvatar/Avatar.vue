<script lang="ts" setup>
import LogoPlayground from './Logo_playground_text.svg';

interface AvatarProps {
	firstName?: string;
	lastName?: string;
	size?: 'xsmall' | 'small' | 'medium' | 'large';
}

defineOptions({ name: 'N8nAvatar' });
const props = withDefaults(defineProps<AvatarProps>(), {
	firstName: '',
	lastName: '',
	size: 'medium',
});

const sizes: { [size: string]: number } = {
	xsmall: 20,
	small: 28,
	large: 48,
	medium: 40,
};
const getSize = (size: string): number => sizes[size];
</script>

<template>
	<span :class="['n8n-avatar', $style.container]" v-bind="$attrs">
		<div :class="[$style.avatar, $style[size]]">
			<LogoPlayground />
		</div>
	</span>
</template>

<style lang="scss" module>
.container {
	position: relative;
	display: inline-flex;
	justify-content: center;
	align-items: center;
	background: white;
}

.avatar {
	border-radius: 50%;
	background: white;
	display: flex;
	justify-content: center;
	align-items: center;
	overflow: hidden;

	:deep(svg) {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
}

.xsmall {
	height: var(--spacing-m);
	width: var(--spacing-m);
}

.small {
	height: 28px;
	width: 28px;
}

.medium {
	height: 40px;
	width: 40px;
}

.large {
	height: 48px;
	width: 48px;
}
</style>
