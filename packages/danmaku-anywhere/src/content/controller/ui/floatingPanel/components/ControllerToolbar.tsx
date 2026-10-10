import { Settings, SettingsBackupRestore } from '@mui/icons-material'
import {
  Box,
  Fade,
  FormControlLabel,
  IconButton,
  LinearProgress,
  Tooltip,
  Typography,
} from '@mui/material'
import { useTranslation } from 'react-i18next'

import { useDialog } from '@/common/components/Dialog/dialogStore'
import { StyledEnableSwitch } from '@/common/components/StyledEnableSwitch'
import { useToast } from '@/common/components/Toast/toastStore'
import { useInjectService } from '@/common/hooks/useInjectService'
import { defaultDanmakuOptions } from '@/common/options/danmakuOptions/constant'
import { DanmakuOptionsService } from '@/common/options/danmakuOptions/service'
import { serializeError } from '@/common/utils/serializeError'
import { episodeToString } from '@/common/danmaku/utils'
import { useAnyLoading } from '@/common/hooks/useAnyLoading'
import { usePlatformInfo } from '@/common/hooks/usePlatformInfo'
import { chromeRpcClient } from '@/common/rpcClient/background/client'
import { useActiveConfig } from '@/content/controller/common/context/useActiveConfig'
import { usePopup } from '@/content/controller/store/popupStore'
import { useStore } from '@/content/controller/store/store'
import { WindowToolbar } from '@/content/controller/ui/floatingPanel/layout/WindowToolbar'

export const ControllerToolbar = () => {
  const { t } = useTranslation()
  const isAnyLoading = useAnyLoading()
  const { toggleOpen, lock, toggleLock } = usePopup()
  const { toggleManualMode, isManual, episodes } = useStore.use.danmaku()
  const { isMobile } = usePlatformInfo()
  const activeConfig = useActiveConfig()
  const dialog = useDialog()
  const toast = useToast.use.toast()
  const danmakuOptionsService = useInjectService(DanmakuOptionsService)

  const episode = episodes?.length === 1 ? episodes[0] : undefined

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
            t(
              'common.restoreDefaultsFailed',
              'Failed to restore defaults: {{message}}',
              { message: serializeError(error).message }
            )
          )
          throw error
        }
      },
    })
  }

  const openSettings = async () => {
    void chromeRpcClient.openPopupInNewWindow({
      path: 'options?from=content',
    })
  }

  return (
    <WindowToolbar
      showLock
      isLocked={lock}
      onLock={toggleLock}
      onUnlock={toggleLock}
      onClose={() => toggleOpen(false)}
      additionalButtons={
        !isMobile && (
          <>
            <IconButton
              onClick={openSettings}
              aria-label={t('common.settings', 'Settings')}
              sx={{
                color: 'inherit',
              }}
            >
              <Settings />
            </IconButton>
            <Tooltip title={t('common.restoreDefaults', 'Restore danmaku settings')}>
              <IconButton
                onClick={handleRestoreDefaults}
                aria-label={t('common.restoreDefaults', 'Restore danmaku settings')}
                data-testid="floating-panel-restore-defaults-button"
                sx={{ color: 'inherit' }}
              >
                <SettingsBackupRestore />
              </IconButton>
            </Tooltip>
          </>
        )
      }
    >
      <>
        <Fade in={isAnyLoading} unmountOnExit>
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: 1,
            }}
          >
            <LinearProgress sx={{ height: '1px' }} />
          </Box>
        </Fade>
        {activeConfig.mode === 'manual' ? (
          episode && (
            <Typography noWrap title={episodeToString(episode)}>
              {episodeToString(episode)}
            </Typography>
          )
        ) : (
          <>
            <Typography
              title={activeConfig.name}
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {activeConfig.name}
            </Typography>
            <FormControlLabel
              control={
                <StyledEnableSwitch
                  checked={!isManual}
                  onChange={() => toggleManualMode()}
                  size="small"
                />
              }
              label={t('integration.autoMode', 'Auto Mode')}
              labelPlacement="top"
              slotProps={{
                typography: {
                  variant: 'caption',
                },
              }}
              sx={{ m: 0, minWidth: 'max-content' }}
            />
          </>
        )}
      </>
    </WindowToolbar>
  )
}
