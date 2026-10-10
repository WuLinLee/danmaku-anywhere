import type { FabProps, PopoverVirtualElement } from '@mui/material'
import {
  Badge,
  ClickAwayListener,
  Fab,
  Fade,
  IconButton,
  SpeedDialIcon,
  Stack,
  Tooltip,
  styled,
} from '@mui/material'
import type { MouseEventHandler } from 'react'
import { forwardRef, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SettingsBackupRestore } from '@mui/icons-material'
import { useDialog } from '@/common/components/Dialog/dialogStore'
import { useToast } from '@/common/components/Toast/toastStore'
import { useInjectService } from '@/common/hooks/useInjectService'
import { defaultDanmakuOptions } from '@/common/options/danmakuOptions/constant'
import { DanmakuOptionsService } from '@/common/options/danmakuOptions/service'
import { serializeError } from '@/common/utils/serializeError'
import { useAnyLoading } from '@/common/hooks/useAnyLoading'
import { useMergeRefs } from '@/common/hooks/useMergeRefs'
import { isConfigIncomplete } from '@/common/options/mountConfig/isPermissive'
import { createVirtualElement } from '@/common/utils/utils'
import { useWindowActive } from '@/content/common/hooks/useWindowActive'
import { useActiveConfig } from '@/content/controller/common/context/useActiveConfig'
import { useStore } from '@/content/controller/store/store'
import { DraggableContainer } from '@/content/controller/ui/components/DraggableContainer'
import { FabContextMenu } from '@/content/controller/ui/floatingButton/components/FabContextMenu'
import { FabLoadingIndicator } from '@/content/controller/ui/floatingButton/components/FabLoadingIndicator'
import { usePersistedFabPosition } from './hooks/usePersistedFabPosition'

interface FloatingButtonProps extends FabProps {
  onOpen: (virtualElement: PopoverVirtualElement) => void
  isOpen: boolean
}

const StyledFab = styled(Fab, {
  shouldForwardProp: (prop) => prop !== 'hover',
})<{ hover: boolean }>(({ hover, theme }) => ({
  transition: 'transform 0.2s ease-in-out',
  transform: hover ? 'rotate(45deg)' : 'rotate(0deg)',
  touchAction: 'none',
  '& .MuiSvgIcon-root': {
    fontSize: theme.typography.pxToRem(24),
  },
}))

const useInitialAnchor = () => {
  const left = 32
  const bottom = window.innerHeight - 128

  return useRef(createVirtualElement(left, bottom))
}

export const FloatingButton = forwardRef<
  HTMLButtonElement,
  FloatingButtonProps
>(({ onOpen, isOpen }: FloatingButtonProps, ref) => {
  const isLoading = useAnyLoading()
  const { t } = useTranslation()
  const dialog = useDialog()
  const toast = useToast.use.toast()
  const danmakuOptionsService = useInjectService(DanmakuOptionsService)

  const handleRestoreDefaults = () => {
    dialog.confirm({
      title: t('common.restoreDefaultsTitle', 'Restore danmaku settings?'),
      content: t(
        'common.restoreDefaultsDescription',
        'This resets every option on the Danmaku Settings page, including style, speed, timeline offset, emission interval, display area, smart density, overlap, distribution, special danmaku, and occlusion.'
      ),
      confirmText: t('common.restore', 'Restore'),
      confirmButtonProps: { color: 'error' },
      onConfirm: async () => {
        try {
          await danmakuOptionsService.set(defaultDanmakuOptions)
          toast.success(
            t(
              'common.restoreDefaultsSuccess',
              'Danmaku settings restored to defaults'
            )
          )
        } catch (error) {
          toast.error(
            t('common.restoreDefaultsFailed', 'Failed to restore defaults: {{message}}', {
              message: serializeError(error).message,
            })
          )
          throw error
        }
      },
    })
  }

  const showFab = useWindowActive()

  const [contextMenuAnchor, setContextMenuAnchor] =
    useState<PopoverVirtualElement | null>(null)
  const [fabHover, setFabHover] = useState(false)

  const { isMounted } = useStore.use.danmaku()
  const isDisconnected = useStore.use.isDisconnected()
  const activeConfig = useActiveConfig()

  const fabAnchor = useInitialAnchor()

  const { initialOffset, handleDragEnd } = usePersistedFabPosition({
    x: 0,
    y: 0,
  })

  const handleTap = (x: number, y: number) => {
    handleCloseContextMenu()
    const virtualElement = createVirtualElement(x, y)
    onOpen(virtualElement)
  }

  const handleCloseContextMenu = () => {
    setContextMenuAnchor(null)
  }

  const handleContextMenu: MouseEventHandler<HTMLElement> = (e) => {
    if (contextMenuAnchor) {
      // if context menu is already open, use the system context menu
      handleCloseContextMenu()
      return
    }
    e.preventDefault()
    const virtualElement = createVirtualElement(e.clientX, e.clientY)
    setContextMenuAnchor(virtualElement)
  }

  const fabRef = useRef<HTMLButtonElement>(null)

  const mergedFabRefs = useMergeRefs(fabRef, ref)

  const dialColor = isDisconnected ? 'error' : isMounted ? 'success' : 'primary'

  const isPicking = useStore((state) => state.integrationForm.isPicking)

  const isIn = !isPicking && (showFab || isOpen || !!contextMenuAnchor)

  const isIncomplete = isConfigIncomplete(activeConfig)

  return (
    <ClickAwayListener onClickAway={handleCloseContextMenu}>
      <div>
        <DraggableContainer
          anchorEl={fabAnchor.current}
          initialOffset={initialOffset}
          sx={{
            zIndex: 1401,
          }}
          onTap={(e) => {
            handleTap(e.clientX, e.clientY)
          }}
          onDragEnd={handleDragEnd}
        >
          {({ bind }) => {
            return (
              <Fade
                in={isIn}
                unmountOnExit={false}
                style={{
                  pointerEvents: isIn ? 'auto' : 'none',
                }}
              >
                <div
                  {...bind()}
                  style={{
                    touchAction: 'none',
                  }}
                >
<Stack direction="row" alignItems="center" spacing={1}>
                    <Badge
                      color="warning"
                      variant="dot"
                      invisible={!isIncomplete}
                      sx={{
                        '& .MuiBadge-badge': {
                          zIndex: 1402,
                        },
                      }}
                    >
                      <StyledFab
                        size="small"
                        onContextMenu={handleContextMenu}
                        ref={mergedFabRefs}
                        color={dialColor}
                        hover={fabHover}
                        onMouseOver={() => setFabHover(true)}
                        onMouseOut={() => setFabHover(false)}
                      >
                        <SpeedDialIcon />
                        <FabLoadingIndicator
                          isLoading={!isDisconnected && isLoading}
                        />
                      </StyledFab>
                    </Badge>
                    <Tooltip
                      title={t(
                        'common.restoreDefaults',
                        'Restore danmaku settings'
                      )}
                      placement="top"
                    >
                      <IconButton
                        size="small"
                        aria-label={t(
                          'common.restoreDefaults',
                          'Restore danmaku settings'
                        )}
                        data-testid="floating-restore-defaults-button"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation()
                          handleRestoreDefaults()
                        }}
                        sx={(theme) => ({
                          width: 40,
                          height: 40,
                          color: theme.palette.text.primary,
                          backgroundColor: theme.palette.background.paper,
                          border: `1px solid ${theme.palette.divider}`,
                          boxShadow: theme.shadows[4],
                          '&:hover': {
                            backgroundColor: theme.palette.action.hover,
                          },
                        })}
                      >
                        <SettingsBackupRestore fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </div>
              </Fade>
            )
          }}
        </DraggableContainer>
        <FabContextMenu
          open={contextMenuAnchor !== null}
          anchorEl={contextMenuAnchor}
          sx={{ zIndex: 1402 }}
        />
      </div>
    </ClickAwayListener>
  )
})

FloatingButton.displayName = 'FloatingButton'
