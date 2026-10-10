import { OpenInNew, Settings, SettingsBackupRestore, Tab } from '@mui/icons-material'
import {
  AppBar,
  Box,
  Fade,
  IconButton,
  LinearProgress,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { DrilldownMenu } from '@/common/components/Menu/DrilldownMenu'
import { useDialog } from '@/common/components/Dialog/dialogStore'
import { useToast } from '@/common/components/Toast/toastStore'
import { defaultDanmakuOptions } from '@/common/options/danmakuOptions/constant'
import { DanmakuOptionsService } from '@/common/options/danmakuOptions/service'
import { useInjectService } from '@/common/hooks/useInjectService'
import { serializeError } from '@/common/utils/serializeError'
import { useAnyLoading } from '@/common/hooks/useAnyLoading'
import { usePlatformInfo } from '@/common/hooks/usePlatformInfo'
import { chromeRpcClient } from '@/common/rpcClient/background/client'
import { TOOLBAR_MIN_HEIGHT } from '@/common/theme/sakura'
import { ThemeToggle } from '@/popup/component/ThemeToggle'
import { EnableExtensionToggle } from './EnableExtensionToggle'

export const AppToolBar = () => {
  const navigate = useNavigate()
  const isAnyLoading = useAnyLoading()
  const { isMobile } = usePlatformInfo()

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

  const openInWindow = () => {
    void chromeRpcClient.openPopupInNewWindow({ path: '' })
  }

  const openInTab = () => {
    void chromeRpcClient.openPopupInNewTab({ path: '' })
  }

  return (
    <AppBar position="static">
      <Toolbar variant="dense" sx={{ minHeight: TOOLBAR_MIN_HEIGHT }}>
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
        <Typography variant="h5" sx={{ flexGrow: 1 }}>
          {t('common.danmakuAnywhere', 'Danmaku Anywhere')}
        </Typography>
        <EnableExtensionToggle />
        <ThemeToggle />
        <IconButton
          onClick={() => {
            navigate('/options')
          }}
          sx={{
            color: 'inherit',
          }}
        >
          <Settings />
        </IconButton>
        <Tooltip title={t('common.restoreDefaults', 'Restore danmaku settings')}>
          <IconButton
            onClick={handleRestoreDefaults}
            aria-label={t('common.restoreDefaults', 'Restore defaults')}
            data-testid="restore-defaults-button"
            sx={{ color: 'inherit' }}
          >
            <SettingsBackupRestore />
          </IconButton>
        </Tooltip>
        {isMobile ? (
          <IconButton
            onClick={openInTab}
            edge="end"
            aria-label={t('common.openInNewTab', 'Open in new tab')}
            data-testid="open-in-tab-button"
            sx={{
              color: 'inherit',
            }}
          >
            <Tab />
          </IconButton>
        ) : (
          <DrilldownMenu
            icon={<OpenInNew />}
            buttonTestId="open-in-new-button"
            ButtonProps={{ edge: 'end', sx: { color: 'inherit' } }}
            items={[
              {
                id: 'open-in-window',
                label: t('common.openInNewWindow', 'Open in new window'),
                icon: <OpenInNew />,
                onClick: openInWindow,
              },
              {
                id: 'open-in-tab',
                label: t('common.openInNewTab', 'Open in new tab'),
                icon: <Tab />,
                onClick: openInTab,
              },
            ]}
          />
        )}
      </Toolbar>
    </AppBar>
  )
}
